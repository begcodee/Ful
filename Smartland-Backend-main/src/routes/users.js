import express from "express";
import { createUser, getUserById, getUsers, loginUser, updateUser } from "../controllers/userControllers.js";

const router = express.Router();

// POST login
router.post("/login", loginUser);

// GET all users
router.get("/", getUsers);

// GET user by id
router.get("/:id", getUserById);

// POST create user
router.post("/", createUser);

// PUT update user
router.put("/:id", updateUser);

export default router;