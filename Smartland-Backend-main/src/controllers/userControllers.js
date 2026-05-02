import pool from "../config/db.js";
import { parseDbId, serializeUser } from "../utils/serializers.js";

const buildDefaultProfile = ({ phoneNumber, country, nationalId }) => ({
  phone: phoneNumber || "",
  address: "",
  city: "",
  state: "",
  country: country || "GH",
  postalCode: "",
  dateOfBirth: "",
  nationalId: nationalId || "",
  bio: "",
  avatar: "",
});

const buildDefaultReputation = () => ({
  score: 50,
  totalTransactions: 0,
  successfulTransactions: 0,
  disputesWon: 0,
  disputesLost: 0,
  communityVotes: 0,
  lastUpdated: new Date().toISOString(),
});

export const getUsers = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    res.json(result.rows.map(serializeUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const userId = parseDbId(req.params.id);
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(serializeUser(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await pool.query(
      `UPDATE users
       SET last_active = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE email = $1 AND password = $2
       RETURNING *`,
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(serializeUser(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to log in" });
  }
};

export const createUser = async (req, res) => {
  try {
    const {
      name,
      full_name,
      email,
      password,
      national_id,
      role = "landowner",
      country = "GH",
      phoneNumber,
      organization,
      verificationStatus = "pending",
      walletAddress,
      profile,
      reputation,
    } = req.body;

    if (!email || !password || !(name || full_name)) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const nationalId = national_id || profile?.nationalId || null;
    const profileData = {
      ...buildDefaultProfile({ phoneNumber, country, nationalId }),
      ...(profile || {}),
      phone: profile?.phone || phoneNumber || "",
      country: profile?.country || country,
      nationalId: profile?.nationalId || nationalId || "",
    };
    const reputationData = {
      ...buildDefaultReputation(),
      ...(reputation || {}),
      lastUpdated: new Date().toISOString(),
    };

    const result = await pool.query(
      `INSERT INTO users (
         full_name, email, password, national_id, role, verification_status, country,
         phone_number, organization, wallet_address, profile, reputation
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name || full_name,
        email,
        password,
        nationalId,
        role,
        verificationStatus,
        country,
        phoneNumber || profileData.phone,
        organization || null,
        walletAddress || "",
        profileData,
        reputationData,
      ]
    );

    res.status(201).json(serializeUser(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create user" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const userId = parseDbId(req.params.id);
    const existing = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const current = existing.rows[0];
    const body = req.body;
    const profileData = {
      ...(current.profile || {}),
      ...(body.profile || {}),
    };
    const reputationData = {
      ...(current.reputation || {}),
      ...(body.reputation || {}),
      lastUpdated: new Date().toISOString(),
    };

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           role = $3,
           verification_status = $4,
           country = $5,
           phone_number = $6,
           organization = $7,
           wallet_address = $8,
           profile = $9,
           reputation = $10,
           last_active = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        body.name || current.full_name,
        body.email || current.email,
        body.role || current.role,
        body.verificationStatus || current.verification_status,
        body.country || current.country,
        body.phoneNumber || profileData.phone || current.phone_number,
        body.organization ?? current.organization,
        body.walletAddress ?? current.wallet_address,
        profileData,
        reputationData,
        userId,
      ]
    );

    res.json(serializeUser(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update user" });
  }
};