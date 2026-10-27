// src/models/Project.js
// One application in the register = one inspection job.
//
// Excel column        -> field
//   Ledger / Page / App No / App date   ledgerNo, pageNo, appNo, appDate
//   Party / Ward / File / Year / MB     party, ward, fileNo, workYear, mbNo
//   Engg Name           contractorName  (the sheet's headers are swapped:
//   Contractor Name     partyEngineer    "Engg Name" holds contractors like
//                                        "Rahul Builders", "Contractor Name"
//                                        holds MCC engineers like "Priyanka")
//   Project Bill Amt    projectBillAmount
//   KM                  km
//   O..AA               charges (calculated, frozen when billed)
//   Insp Date           inspectionDate
//   Insp by name 1..14  team[]
//   AE / AF             derived from team (count / column positions), not stored
//   Remarks             remarks; "Certificate Not Issued" / "Cancelled As Date
//                       Mismatch" become status values

import mongoose from "mongoose";

export const PROJECT_STATUSES = [
  "received", // application entered
  "assigned", // inspection team allotted
  "inspected", // site visit done
  "report_issued", // certificate / report sent to the party
  "billed", // included in a service bill
  "paid", // receipt fully covers it
  "on_hold", // e.g. certificate not issued
  "cancelled", // e.g. date mismatch
];

// Allowed moves; anything else is rejected by the API.
export const STATUS_FLOW = {
  received: ["assigned", "on_hold", "cancelled"],
  assigned: ["inspected", "received", "on_hold", "cancelled"],
  inspected: ["report_issued", "on_hold", "cancelled"],
  report_issued: ["billed", "on_hold"],
  billed: ["paid"], // reversing a bill goes through bill cancellation
  paid: [],
  on_hold: ["received", "assigned", "inspected", "report_issued", "cancelled"],
  cancelled: [],
};

const money = { type: Number, default: 0, min: 0 }; // paise

const teamMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // inspector: shares the 45% pool. support: shares the 10% pool.
    role: { type: String, enum: ["inspector", "support"], default: "inspector" },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const chargesSchema = new mongoose.Schema(
  {
    ruleCode: String,
    gstMode: String,
    servicePercent: Number,
    lumpsum: Boolean,
    projectBillAmount: money,
    claimed: money,
    gst: money,
    net: money,
    invoiceTotal: money,
    km: Number,
    ta: money,
    amount: money,
    shares: { type: Map, of: Number },
    profitSplit: { type: Map, of: Number },
    calculatedAt: Date,
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    financialYear: { type: String, required: true, index: true }, // "2025-26"
    serialNo: { type: Number, required: true }, // Sl. No. within the year

    ledgerNo: { type: String, trim: true, default: "" },
    pageNo: { type: String, trim: true, default: "" },
    appNo: { type: String, trim: true, required: true }, // text: "57/1" exists
    appDate: { type: Date, required: true },
    appDetails: { type: String, trim: true, default: "", maxlength: 1000 }, // name / description of work
    workType: { type: String, enum: ["civil", "electrical", "mechanical", "other"], default: "civil" },

    // The inward letter: reference printed on it, its date, and the scan.
    inward: {
      letterRefNo: { type: String, trim: true, default: "" },
      letterDate: { type: Date, default: null },
      scan: { type: mongoose.Schema.Types.ObjectId, ref: "IntakeScan", default: null },
    },

    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true, index: true },
    ward: { type: String, trim: true, default: "" },
    fileNo: { type: String, trim: true, default: "" },
    workYear: { type: String, trim: true, default: "" }, // year of the work order
    mbNo: { type: String, trim: true, default: "" }, // measurement book

    contractorName: { type: String, trim: true, default: "", index: true },
    partyEngineer: { type: String, trim: true, default: "" },
    partyEngineerDesignation: { type: String, trim: true, default: "" },
    partyEngineerPhone: { type: String, trim: true, default: "" },

    // From the request letter's table
    fundSource: { type: String, trim: true, default: "" }, // ಅನುದಾನ, as written on the letter
    fund: { type: mongoose.Schema.Types.ObjectId, ref: "Fund", default: null, index: true }, // chosen from the list
    estimateAmount: { type: Number, min: 0, default: null }, // ಅಂದಾಜು ಮೊತ್ತ, paise
    workStartedOn: { type: Date, default: null }, // ಪ್ರಾರಂಭಿಸಿದ ದಿನಾಂಕ
    workCompletedOn: { type: Date, default: null }, // ಪೂರ್ಣಗೊಂಡ ದಿನಾಂಕ

    projectBillAmount: { ...money, required: true },
    km: { type: Number, default: 0, min: 0 },
    gstMode: { type: String, enum: ["inclusive", "exclusive"] }, // default from party
    lumpsumFee: { type: Number, min: 0, default: null }, // paise

    team: [teamMemberSchema],
    plannedInspectionDate: { type: Date, default: null }, // set by the coordinator
    inspectionDate: { type: Date, default: null },

    report: {
      certificateNo: { type: String, trim: true, default: "" },
      issuedOn: { type: Date, default: null },
      fileUrl: { type: String, default: "" }, // Cloudinary, authenticated delivery
      filePublicId: { type: String, default: "" },
    },

    charges: { type: chargesSchema, default: null },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null, index: true },

    status: { type: String, enum: PROJECT_STATUSES, default: "received", index: true },
    statusHistory: [
      {
        _id: false,
        from: String,
        to: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
      },
    ],
    remarks: { type: String, trim: true, default: "", maxlength: 1000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

projectSchema.index({ financialYear: 1, serialNo: 1 }, { unique: true });
projectSchema.index({ party: 1, appNo: 1, financialYear: 1 });
projectSchema.index({ "team.user": 1, status: 1 });

// Warnings the register shows today with IF(E>AC,1,0) and red rows.
projectSchema.virtual("warnings").get(function () {
  const w = [];
  if (this.inspectionDate && this.appDate && this.inspectionDate < this.appDate)
    w.push("Inspection date is before application date.");
  if (["assigned", "inspected"].includes(this.status) && !this.team?.some((m) => m.role === "inspector"))
    w.push("No inspector assigned.");
  return w;
});

projectSchema.set("toJSON", { virtuals: true });

export default mongoose.models.Project || mongoose.model("Project", projectSchema);
