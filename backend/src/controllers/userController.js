// src/controllers/userController.js

import cloudinary from "../config/cloudinary.js";
import { clerkClient } from "@clerk/express";
import XLSX from "xlsx";
import axios from "axios";


import User, { DESIGNATIONS, normalizeDesignation, collegeOf } from "../models/User.js";

import { ROLES } from "../config/roles.js";
// import Attendance from "../models/Attendance.js";
// import IAMarks from "../models/IAMarks.js";

export const getDashboardStats = async (req, res) => {
  try {
    console.log("======================================");
    console.log("FETCHING DASHBOARD STATISTICS");
    console.log("======================================");

    const [
      facultyCount,
      subjectCount,
      studentCount,
      attendanceCount,
      iaMarksCount,
    ] = await Promise.all([
      User.countDocuments({
        role: "staff",
      }),

      Subject.countDocuments(),

      Student.countDocuments(),

      // Attendance.countDocuments(),

      // IAMarks.countDocuments(),
    ]);

    console.log("Faculty:", facultyCount);
    console.log("Subjects:", subjectCount);
    console.log("Students:", studentCount);
    console.log("Attendance:", attendanceCount);
    console.log("IA Marks:", iaMarksCount);

    return res.status(200).json({
      success: true,

      data: {
        faculty: facultyCount,
        subjects: subjectCount,
        students: studentCount,
        // attendance: attendanceCount,
        // iaMarks: iaMarksCount,
      },
    });

  } catch (error) {

    console.error(
      "======================================"
    );

    console.error(
      "DASHBOARD STATISTICS ERROR"
    );

    console.error(
      error
    );

    console.error(
      "======================================"
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// The roles and what each one does: see config/roles.js
const ALL_ROLES = ROLES;

// Roles that may open the login-accounts list
const ADMIN_ROLES = ["admin", "principal", "coe", "acoe"];

// Which roles each role may create, edit and delete
const rolePermissions = {
  admin: [...ROLES],
  principal: ["acoe", "office", "exam_clerk", "qp_scrutinizer", "hod", "staff"],
  coe: ["acoe", "office", "exam_clerk", "qp_scrutinizer", "hod", "staff"],
  acoe: ["office", "exam_clerk", "hod", "staff"],
  hod: ["staff"],
};


/*
|--------------------------------------------------------------------------
| UTILITY
|--------------------------------------------------------------------------
*/

const canManage = (requesterRole, targetRole) => {
  const permissions = rolePermissions[requesterRole];

  if (!permissions) {
    return false;
  }

  return permissions.includes(targetRole);
};


/*
|--------------------------------------------------------------------------
| GET CLERK USERS
|--------------------------------------------------------------------------
|
| Used by the Admin User Management page.
|
|--------------------------------------------------------------------------
*/

export const getClerkUsers = async (req, res) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    // =====================================================
    // ACCESS CHECK
    // =====================================================

    if (!ADMIN_ROLES.includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // =====================================================
    // FETCH ALL CLERK USERS
    // =====================================================

    let allUsers = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const result =
        await clerkClient.users.getUserList({
          limit,
          offset,
        });

      if (
        !result.data ||
        result.data.length === 0
      ) {
        break;
      }

      allUsers.push(...result.data);

      offset += result.data.length;

      if (result.data.length < limit) {
        break;
      }
    }

    // =====================================================
    // FETCH MONGODB USERS
    // =====================================================

    const mongoUsers = await User.find({})
      .select(
        "clerkId imageUrl imagePublicId phone department role designation collegeCode collegeName"
      )
      .lean();

    // =====================================================
    // CREATE USER LOOKUP
    // =====================================================

    const mongoUserMap = new Map(
      mongoUsers.map((user) => [
        user.clerkId,
        user,
      ])
    );

    // =====================================================
    // FETCH STUDENTS
    // =====================================================

    const students = await Student.find({})
      .select(
        "clerkId imageUrl imagePublicId phone department role semester registerNumber"
      )
      .lean();

    // =====================================================
    // CREATE STUDENT LOOKUP
    // =====================================================

    const studentMap = new Map(
      students.map((student) => [
        student.clerkId,
        student,
      ])
    );

    // =====================================================
    // COMBINE CLERK + MONGODB DATA
    // =====================================================

    const clerkUsers = allUsers.map((user) => {

      const mongoUser =
        mongoUserMap.get(user.id);

      const student =
        studentMap.get(user.id);

      // =================================================
      // DETERMINE ROLE
      // =================================================

      const role =
        student?.role ||
        mongoUser?.role ||
        user.publicMetadata?.role ||
        null;

      // =================================================
      // DETERMINE IMAGE
      // =================================================

      let imageUrl = null;

      if (role === "student") {

        // Student MongoDB image first
        imageUrl =
          student?.imageUrl ||
          user.imageUrl ||
          null;

      } else {

        // Faculty / other users
        // MongoDB Cloudinary image first
        imageUrl =
          mongoUser?.imageUrl ||
          user.imageUrl ||
          null;
      }

      // =================================================
      // RETURN USER
      // =================================================

      return {
        clerkId: user.id,

        firstName:
          user.firstName,

        lastName:
          user.lastName,

        name:
          `${user.firstName || ""} ${
            user.lastName || ""
          }`.trim() ||
          "Unnamed User",

        email:
          user.emailAddresses?.[0]
            ?.emailAddress || "",

        imageUrl,

        phone:
          student?.phone ||
          mongoUser?.phone ||
          user.phoneNumbers?.[0]
            ?.phoneNumber ||
          "",

        role,

        department:
          student?.department ||
          mongoUser?.department ||
          user.publicMetadata?.department ||
          null,

        // Students: semester and register number
        semester: student?.semester ?? null,
        registerNumber: student?.registerNumber || "",

        // Staff: designation and college (empty college = ours, 103)
        designation: mongoUser?.designation || "",
        collegeCode: role === "student" ? "" : collegeOf(mongoUser).code,
        collegeName: role === "student" ? "" : collegeOf(mongoUser).name,

        createdAt:
          user.createdAt,
      };
    });

    console.log(
      `Clerk users fetched: ${clerkUsers.length}`
    );

    return res.status(200).json({
      success: true,
      data: clerkUsers,
    });

  } catch (error) {

    console.error(
      "Get Clerk Users Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
    });
  }
};
const getGoogleDriveFileId = (url) => {
  if (!url) return null;

  const value = String(url).trim();

  // /file/d/FILE_ID/view
  const fileMatch = value.match(
    /\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (fileMatch) {
    return fileMatch[1];
  }

  // ?id=FILE_ID
  const idMatch = value.match(
    /[?&]id=([a-zA-Z0-9_-]+)/
  );

  if (idMatch) {
    return idMatch[1];
  }

  return null;
};

const uploadGoogleDrivePhoto = async (driveUrl) => {
  if (!driveUrl) {
    return {
      secure_url: "",
      public_id: "",
    };
  }

  const fileId = getGoogleDriveFileId(driveUrl);

  if (!fileId) {
    throw new Error(
      "Invalid Google Drive photo link."
    );
  }

  const downloadUrl =
    `https://drive.google.com/uc?export=download&id=${fileId}`;

  const response = await axios.get(
    downloadUrl,
    {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    }
  );

  const contentType =
    response.headers["content-type"] || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      "Google Drive file is not a valid image or is not publicly accessible."
    );
  }

  const base64 =
    Buffer.from(response.data).toString("base64");

  const dataUri =
    `data:${contentType};base64,${base64}`;

  const result =
    await cloudinary.uploader.upload(
      dataUri,
      {
        folder: "kpt-examination/faculty",
        resource_type: "image",
      }
    );

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };
};

/*
|--------------------------------------------------------------------------
| BULK UPLOAD FACULTY
|--------------------------------------------------------------------------
| Excel columns:
| Name | Email | Phone | Department
|
| Role is automatically set to "staff"
|--------------------------------------------------------------------------
*/

export const bulkUploadFaculty = async (
  req,
  res
) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | PERMISSION
    |--------------------------------------------------------------------------
    */

    if (!canManage(requesterRole, "staff")) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to bulk upload faculty.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | EXCEL FILE
    |--------------------------------------------------------------------------
    */

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload an Excel or CSV file.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | READ EXCEL
    |--------------------------------------------------------------------------
    */

    const workbook = XLSX.read(
      req.file.buffer,
      {
        type: "buffer",
      }
    );

    const sheetName =
      workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message:
          "The uploaded file contains no worksheet.",
      });
    }

    const worksheet =
      workbook.Sheets[sheetName];

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
        }
      );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message:
          "The uploaded file contains no data.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALID DEPARTMENTS
    |--------------------------------------------------------------------------
    */

    const validDepartments = [
      "at",
      "ch",
      "ce",
      "cs",
      "ec",
      "ee",
      "me",
      "ps",
      "sc",
      "ot",
      "",
    ];

    /*
    |--------------------------------------------------------------------------
    | RESULT
    |--------------------------------------------------------------------------
    */

    const results = {
      total: rows.length,
      created: 0,
      failed: 0,
      errors: [],
    };

    /*
    |--------------------------------------------------------------------------
    | PROCESS EACH ROW
    |--------------------------------------------------------------------------
    */

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const excelRow = i + 2;

      const name = String(
        row.Name ||
          row.name ||
          ""
      ).trim();

      const email = String(
        row.Email ||
          row.email ||
          ""
      )
        .trim()
        .toLowerCase();

      const phone = String(
        row.Phone ||
          row.phone ||
          ""
      ).trim();

      const department = String(
        row.Department ||
          row.department ||
          ""
      )
        .trim()
        .toLowerCase();

      // External examiners: their college. Empty = our own college (103).
      const collegeCode = String(
        row["College Code"] || row["Institution Code"] || row["Inst Code"] || row.collegeCode || ""
      ).trim();

      const collegeName = String(
        row["College Name"] || row["Institution Name"] || row["Inst Name"] || row.collegeName || ""
      ).trim();

      const designation = normalizeDesignation(row.Designation ?? row.designation);

      const photo = String(
        row.Photo ||
          row.photo ||
          ""
      ).trim();

      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

      if (!name) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          message: "Name is required.",
        });

        continue;
      }

      if (!email) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          message: "Email is required.",
        });

        continue;
      }

      if (!email.includes("@")) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          email,
          message:
            "Invalid email address.",
        });

        continue;
      }

      if (designation === null) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          email,
          message: `Invalid designation. Use one of: ${DESIGNATIONS.join(", ")}.`,
        });

        continue;
      }

      if (collegeCode && collegeCode !== "103" && !collegeName) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          email,
          message:
            `College name is required for an external examiner (college code ${collegeCode}).`,
        });

        continue;
      }

      if (
        !validDepartments.includes(
          department
        )
      ) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          email,
          message:
            `Invalid department: ${department}`,
        });

        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | DUPLICATE CHECK
      |--------------------------------------------------------------------------
      */

      const existingUser =
        await User.findOne({
          email,
        });

      if (existingUser) {
        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          email,
          message:
            "User with this email already exists.",
        });

        continue;
      }

      let clerkUser = null;
      let cloudinaryResult = null;

      try {
        /*
        |--------------------------------------------------------------------------
        | GOOGLE DRIVE PHOTO
        |--------------------------------------------------------------------------
        */

        if (photo) {
          cloudinaryResult =
            await uploadGoogleDrivePhoto(
              photo
            );
        }

        /*
        |--------------------------------------------------------------------------
        | CREATE CLERK USER
        |--------------------------------------------------------------------------
        */

        clerkUser =
          await clerkClient.users.createUser(
            {
              emailAddress: [email],

              firstName: name,

              publicMetadata: {
                role: "staff",
                department,
              },
            }
          );

        /*
        |--------------------------------------------------------------------------
        | CREATE MONGODB USER
        |--------------------------------------------------------------------------
        */

        const user = new User({
          name,
          email,
          phone,
          department,
          collegeCode,
          collegeName,
          designation,
          role: "staff",

          clerkId:
            clerkUser.id,

          imageUrl:
            cloudinaryResult
              ?.secure_url || "",

          imagePublicId:
            cloudinaryResult
              ?.public_id || "",
        });

        await user.save();

        results.created++;
      } catch (error) {
        console.error(
          `Bulk faculty row ${excelRow} error:`,
          error
        );

        /*
        |--------------------------------------------------------------------------
        | CLEANUP CLERK IF MONGODB FAILED
        |--------------------------------------------------------------------------
        */

        if (clerkUser?.id) {
          try {
            await clerkClient.users.deleteUser(
              clerkUser.id
            );
          } catch (cleanupError) {
            console.error(
              "Clerk cleanup error:",
              cleanupError
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | CLEANUP CLOUDINARY IF CREATED
        |--------------------------------------------------------------------------
        */

        if (
          cloudinaryResult?.public_id
        ) {
          try {
            await cloudinary.uploader.destroy(
              cloudinaryResult.public_id
            );
          } catch (cleanupError) {
            console.error(
              "Cloudinary cleanup error:",
              cleanupError
            );
          }
        }

        results.failed++;

        results.errors.push({
          row: excelRow,
          name,
          email,
          message:
            error?.errors?.[0]
              ?.message ||
            error?.message ||
            "Failed to create faculty.",
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      message:
        "Bulk faculty upload completed.",

      data: results,
    });
  } catch (error) {
    console.error(
      "Bulk Faculty Upload Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to process bulk faculty upload.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE CLERK USER
|--------------------------------------------------------------------------
*/

export const deleteClerkUser = async (
  req,
  res
) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    /*
     * Only admin can directly delete Clerk
     * accounts from the general user-management page.
     */
    if (requesterRole !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can delete user accounts from this page.",
      });
    }

    const { clerkId } = req.params;

    if (!clerkId) {
      return res.status(400).json({
        success: false,
        message: "Clerk user ID is required.",
      });
    }

    /*
     * Prevent admin from deleting own account.
     */
    if (clerkId === req.user?.id) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot delete your own account.",
      });
    }

    /*
     * Delete from Clerk
     */
    await clerkClient.users.deleteUser(
      clerkId
    );

    /*
     * Also remove corresponding MongoDB user.
     */
    await User.findOneAndDelete({
      clerkId,
    });

    return res.status(200).json({
      success: true,
      message:
        "User account deleted successfully.",
    });

  } catch (error) {
    console.error(
      "Delete Clerk User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete user account.",
    });
  }
};


/*
|--------------------------------------------------------------------------
| CREATE USER
|--------------------------------------------------------------------------
|
| Creates:
| 1. Clerk account
| 2. MongoDB account
|
|--------------------------------------------------------------------------
*/

export const createUser = async (
  req,
  res
) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    const {
      name,
      email,
      phone,
      department,
      role,
      collegeCode,
      collegeName,
      designation: rawDesignation,
    } = req.body;

    const designation = normalizeDesignation(rawDesignation);
    if (designation === null) {
      return res.status(400).json({
        success: false,
        message: `Designation must be one of: ${DESIGNATIONS.join(", ")}.`,
      });
    }

    const targetRole = (
      role || ""
    ).toLowerCase();

    /*
     * Validate role
     */
    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: "Role is required.",
      });
    }

    if (!ALL_ROLES.includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid role.",
      });
    }

    /*
     * Check permission
     */
    if (
      !canManage(
        requesterRole,
        targetRole
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to create this type of user.",
      });
    }

    /*
     * Required fields
     */
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    /*
     * Check MongoDB duplicate
     */
    const existingUser =
      await User.findOne({
        email: email.toLowerCase().trim(),
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this email already exists.",
      });
    }

    /*
     * Create Clerk user
     */
    const clerkUser =
      await clerkClient.users.createUser({
        emailAddress: [
          email.trim(),
        ],

        firstName:
          name.trim(),

        publicMetadata: {
          role: targetRole,

          department:
            department || "",
        },
      });

    /*
     * Create MongoDB user
     */
    const user = new User({
      name: name.trim(),

      email:
        email.trim().toLowerCase(),

      phone:
        phone?.trim() || "",

      department:
        department || "",

      collegeCode: String(collegeCode || "").trim(),
      collegeName: String(collegeName || "").trim(),
      designation,

      role: targetRole,

      clerkId:
        clerkUser.id,

      imageUrl:
        req.cloudinaryResult
          ?.secure_url,

      imagePublicId:
        req.cloudinaryResult
          ?.public_id,
    });

    await user.save();

    return res.status(201).json({
      success: true,

      message:
        "User created successfully.",

      data: user,
    });

  } catch (err) {
    console.error(
      "CreateUser Error:",
      err
    );

    /*
     * If MongoDB creation fails after
     * Clerk creation, try removing Clerk user.
     */
    if (
      err.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A user with the same information already exists.",
      });
    }

    if (
      err.clerkError &&
      err.errors
    ) {
      return res.status(
        err.status || 400
      ).json({
        success: false,

        message:
          err.errors[0]
            ?.message ||
          "Failed to create user.",

        errors:
          err.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal server error.",
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET ALL USERS / FACULTY
|--------------------------------------------------------------------------
*/

export const getUsers = async (req, res) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    const requesterDepartment = String(
      req.user?.department || ""
    )
      .trim()
      .toLowerCase();

    const { department, role } = req.query;

    const filter = {};

    // =====================================================
    // HOD
    // =====================================================
    // HOD can ONLY see staff belonging to his department.
    // Department supplied from frontend is ignored.
    // =====================================================

    if (requesterRole === "hod") {
      if (!requesterDepartment) {
        return res.status(403).json({
          success: false,
          message: "HOD department is not assigned.",
        });
      }

      filter.department = requesterDepartment;

      // HOD faculty page should show only staff
      filter.role = "staff";
    }

    // =====================================================
    // OTHER ADMINISTRATIVE ROLES
    // =====================================================

    else {
      // Optional role filter
      if (role?.trim()) {
        filter.role = role.trim().toLowerCase();
      }

      // Optional department filter
      if (department?.trim()) {
        filter.department = department
          .trim()
          .toLowerCase();
      }
    }

    // =====================================================
    // FETCH USERS
    // =====================================================

    const users = await User.find(filter)
      .select(
        "name email phone department designation role collegeCode collegeName imageUrl imagePublicId createdAt"
      )
      .sort({
        department: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    console.error("Get Users Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET USER BY ID
|--------------------------------------------------------------------------
*/

export const getUserById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    let user;

    if (
      id.startsWith("user_")
    ) {
      user =
        await User.findOne({
          clerkId: id,
        });
    } else {
      user =
        await User.findById(id);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      data: user,
    });

  } catch (err) {
    console.error(
      "Get User By ID Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
*/

export const updateUser = async (
  req,
  res
) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    const requesterId =
      req.user?.id;

    const { id } =
      req.params;

    let targetUser;

    /*
     * Find target user
     */
    if (
      id.startsWith("user_")
    ) {
      targetUser =
        await User.findOne({
          clerkId: id,
        });
    } else {
      targetUser =
        await User.findById(id);
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
     * User cannot modify another account
     * unless requester has permission.
     */
    if (
      targetUser.clerkId !==
      requesterId
    ) {
      if (
        !canManage(
          requesterRole,
          targetUser.role
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to update this user.",
        });
      }
    }

    const updateData = {
      ...req.body,
    };

    if (updateData.designation !== undefined) {
      updateData.designation = normalizeDesignation(updateData.designation);
      if (updateData.designation === null) {
        return res.status(400).json({
          success: false,
          message: `Designation must be one of: ${DESIGNATIONS.join(", ")}.`,
        });
      }
    }

    /*
     * Validate role if supplied
     */
    if (
      updateData.role
    ) {
      updateData.role =
        updateData.role
          .toLowerCase();

      if (
        !ALL_ROLES.includes(
          updateData.role
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid role.",
        });
      }

      /*
       * Requester must have permission
       * to assign the new role.
       */
      if (
        targetUser.clerkId !==
        requesterId &&
        !canManage(
          requesterRole,
          updateData.role
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to assign this role.",
        });
      }
    }

    /*
     * Prevent changing Clerk ID
     */
    delete updateData.clerkId;

    /*
     * Prevent changing timestamps
     */
    delete updateData.createdAt;
    delete updateData.updatedAt;

    /*
     * Cloudinary image
     */
    if (req.cloudinaryResult) {
      updateData.imageUrl =
        req.cloudinaryResult.secure_url;

      updateData.imagePublicId =
        req.cloudinaryResult.public_id;
    }

    const newRole =
      updateData.role ||
      targetUser.role;

    const newDepartment =
      updateData.department !==
      undefined
        ? updateData.department
        : targetUser.department;

    /*
     * Update Clerk metadata
     */
    await clerkClient.users.updateUser(
      targetUser.clerkId,
      {
        publicMetadata: {
          role: newRole,
          department:
            newDepartment || "",
        },
      }
    );

    /*
     * Update MongoDB
     */
    const user =
      await User.findByIdAndUpdate(
        targetUser._id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    return res.json({
      success: true,
      message:
        "User updated successfully.",
      data: user,
    });

  } catch (err) {
    console.error(
      "UpdateUser Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| DELETE USER
|--------------------------------------------------------------------------
*/

export const deleteUser = async (
  req,
  res
) => {
  try {
    const requesterRole = (
      req.user?.role || ""
    ).toLowerCase();

    const requesterId =
      req.user?.id;

    const { id } =
      req.params;

    let user;

    if (
      id.startsWith("user_")
    ) {
      user =
        await User.findOne({
          clerkId: id,
        });
    } else {
      user =
        await User.findById(id);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
     * Prevent self deletion
     */
    if (
      user.clerkId ===
      requesterId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot delete your own account.",
      });
    }

    /*
     * Permission: deleting an account is for the Admin only
     */
    if (requesterRole !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only the Admin can delete users. Please ask the Admin.",
      });
    }

    /*
     * Delete Cloudinary image
     */
    if (
      user.imagePublicId
    ) {
      try {
        await cloudinary.uploader.destroy(
          user.imagePublicId
        );
      } catch (err) {
        console.error(
          "Cloudinary deletion error:",
          err
        );
      }
    }

    /*
     * Delete Clerk account
     */
    try {
      await clerkClient.users.deleteUser(
        user.clerkId
      );
    } catch (err) {
      console.error(
        "Clerk deletion error:",
        err
      );
    }

    /*
     * Delete MongoDB record
     */
    await user.deleteOne();

    return res.json({
      success: true,
      message:
        "User deleted successfully.",
    });

  } catch (err) {
    console.error(
      "DeleteUser Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| SYNC CLERK USER → MONGODB
|--------------------------------------------------------------------------
*/

export const syncUser = async (
  req,
  res
) => {
  try {
    const clerkId =
      req.user.id;

    let user =
      await User.findOne({
        clerkId,
      });

    if (!user) {
      const clerkUser =
        await clerkClient.users.getUser(
          clerkId
        );

      const clerkRole =
        (
          clerkUser.publicMetadata
            ?.role || "student"
        ).toLowerCase();

      /*
       * Protect against invalid role
       */
      const validRole =
        ALL_ROLES.includes(
          clerkRole
        )
          ? clerkRole
          : "student";

      user = new User({
        name:
          clerkUser.firstName ||
          "Unknown",

        email:
          clerkUser
            .emailAddresses?.[0]
            ?.emailAddress ||
          "unknown@example.com",

        phone:
          clerkUser
            .phoneNumbers?.[0]
            ?.phoneNumber ||
          "",

        role: validRole,

        department:
          clerkUser
            .publicMetadata
            ?.department || "",

        clerkId:
          clerkUser.id,

        imageUrl:
          clerkUser.imageUrl ||
          "/default-avatar.png",
      });

      await user.save();

      console.log(
        `User synced: ${user.email}`
      );
    }

    return res.json({
      success: true,
      data: user,
    });

  } catch (err) {
    console.error(
      "SyncUser Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET CURRENT AUTHENTICATED USER
|--------------------------------------------------------------------------
*/

export const getCurrentUser = async (
  req,
  res
) => {
  try {
    const clerkId =
      req.user.id;

    const user =
      await User.findOne({
        clerkId,
      }).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,

        code:
          "USER_NOT_FOUND",

        message:
          "User is authenticated with Clerk but not registered in the college system.",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });

  } catch (error) {
    console.error(
      "GetCurrentUser Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch current user.",
    });
  }
};