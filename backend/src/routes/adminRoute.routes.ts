import { Router } from "express";
import {
  handleAdminCourseDisplay,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminRegister,
  handleCourseCreation,
} from "../controllers/admin.controllers";
import { checkAuth } from "../middlewares/adminAuth.middlewares";
import { upload } from "../middlewares/multer.middlewares";

export const adminRouter = Router();

adminRouter
  .post("/register", handleAdminRegister)
  .post("/login", handleAdminLogin);

adminRouter.use(checkAuth);

adminRouter
  .get("/logout", handleAdminLogout)
  .post("/course", upload.single("coverImg"), handleCourseCreation)
  .get("/courses", handleAdminCourseDisplay);