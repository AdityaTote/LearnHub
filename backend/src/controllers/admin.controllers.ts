import bcrypt, { hash } from "bcrypt";
import { Request, Response } from "express";
import { Admin } from "../models/admin.models";
import * as z from "zod";
import { hashPass, verifyPass } from "../utils/managePass.utils";
import { signToken } from "../utils/jwt.utils";
import { adminJwtSecret } from "../constant";
import { Course } from "../models/course.models";
import { uploadImage } from "../utils/cloudinary.utils";

const userSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6),
  firstName: z.string(),
  lastName: z.string(),
});

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6),
});

const courseSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.string(),
});

type courseType = z.infer<typeof courseSchema>;

const option = {
  httpOnly: true,
};

const handleAdminRegister = async (req: Request, res: Response) => {
  //   check user data validation
  const userData = userSchema.safeParse(req.body);

  if (!userData.success) {
    return res.status(400).json({ error: userData.error });
  }

  const { email, password, firstName, lastName } = userData.data;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  //   check user already exists or not
  const userExists = await Admin.findOne({ email });

  if (userExists) {
    return res.status(400).json({ error: "Admin already exists" });
  }

  //   pass hassing
  const hashedPass = await hashPass(password);

  if (!hashedPass) {
    return res.status(500).json({
      error: "Error in pass hassing",
    });
  }

  const user = await Admin.create({
    email: email,
    firstName: firstName,
    lastName: lastName,
    password: hashedPass,
  });

  if (!user) {
    return res.status(500).json({ error: "Error in creating user" });
  }

  return res.status(201).json({
    message: "Admin created successfully",
    user: user,
  });
};

const handleAdminLogin = async (req: Request, res: Response) => {
  try {
    const userData = loginSchema.safeParse(req.body);

    if (!userData.success) {
      return res.status(400).json({ error: userData.error });
    }

    const { email, password } = userData.data;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    //   check user already exists or not
    const userExists = await Admin.findOne({ email });

    if (!userExists) {
      return res.status(400).json({ error: "Admin doesnot exists" });
    }

    //   pass check
    const passCheck = await verifyPass(password, userExists.password);

    if (!passCheck) {
      return res.status(404).json({
        error: "Invalid password",
      });
    }

    const adminSecreteKey: string = adminJwtSecret || "qazplm";

    const token = signToken(userExists, adminSecreteKey);

    return res.status(200).cookie("adminSessionId", token, option).json({
      message: "Admin logged in successfully",
      data: userExists,
    });
  } catch (error: any) {
    console.log(error);
    return res.json({
      error: error.message,
    });
  }
};

const handleAdminLogout = async (req: any, res: Response) => {
  const admin = req.admin;

  if (!admin) {
    return res.status(400).json({ error: "Admin not found" });
  }

  return res.clearCookie("adminSessionId").json({
    message: "Admin logged out successfully",
  });
};

const handleCourseCreation = async (req: any, res: Response) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        error: "User is unauthorized",
      });
    }

    const courseData = courseSchema.safeParse(req.body);

    if (!courseData.success) {
      return res.status(400).json({ error: courseData.error });
    }

    const { title, description, price } = courseData.data;

    if (!title || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const courseExists = await Course.findOne({
      title: title,
      createdBy: admin.id,
    });

    if (courseExists) {
      return res.status(400).json({ error: "Course already exists" });
    }

    const imageLocalUrl = req.file.path;

    console.log(imageLocalUrl);

    if (!imageLocalUrl) {
      return res.status(400).json({ error: "Image is required" });
    }

    const imageURL = await uploadImage(imageLocalUrl);

    console.log(imageURL);

    if (!imageURL) {
      return res.status(500).json({ error: "Error in uploading image" });
    }

    const course = await Course.create({
      title: title,
      description: description,
      price: price,
      imageURL: imageURL,
      ownerName: admin.firstName + " " + admin.lastName,
      createdBy: admin.id,
    });

    if (!course) {
      return res.status(500).json({ error: "Error in creating course" });
    }

    return res.status(201).json({
      message: "Course created successfully",
      data: course,
    });
  } catch (error: any) {
    console.log(error);
    return res.json({
      error: error.message,
    });
  }
};

const handleAdminCourseDisplay = async (req: any, res: Response) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({ error: "User is unauthorized" });
    }

    const courses = await Course.find({ createdBy: admin.id });

    if (!courses) {
      return res.status(404).json({ error: "Courses not found" });
    }

    return res.status(200).json({
      message: "Courses fetched successfully",
      data: courses,
    });
  } catch (error: any) {
    console.log(error);
    return res.json({
      error: error.message,
    });
  }
};

const handleCourseUpdate = async (req: any, res: Response) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const courseId = req.params.id;

    if (!courseId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const courseData = courseSchema.safeParse(req.body);

    if (!courseData.success) {
      return res.status(400).json({ error: courseData.error });
    }

    const { title, description, price } = courseData.data;

    
    const courseInputData: {
      title?: string;
      description?: string;
      price?: string;
    } = {};

    if (title) {
      courseInputData.title = title;
    }

    if (price) {
      courseInputData.price = price;
    }

    if (description) {
      courseInputData.description = description;
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      courseInputData,
      { new: true }
    );

    if (!updatedCourse) {
      return res.status(500).json({ error: "Error in updating course" });
    }

    return res.status(200).json({
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error: any) {
    console.log(error);
    return res.json({ error: error.message });
  }
};

const handleCourseDelete = async (req: any, res: Response) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const courseId  = req.params.id;

    if (!courseId) {
      return res.status(403).json({
        error: "Please provide CourseId",
      });
    }

    const deletedCourse = await Course.findByIdAndDelete(courseId);

    if (!deletedCourse) {
      return res.status(500).json({
        error: "Error in deleting course",
      });
    }

    return res.status(200).json({
      message: "Course deleted successfully",
    });
  } catch (error: any) {
    console.log(error);
    return res.json({ error: error.message });
  }
};

export {
  handleAdminRegister,
  handleAdminLogin,
  handleAdminLogout,
  handleCourseCreation,
  handleAdminCourseDisplay,
  handleCourseUpdate,
  handleCourseDelete,
};
