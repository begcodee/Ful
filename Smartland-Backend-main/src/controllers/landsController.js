import pool from "../config/db.js";
import { parseDbId, serializeLand } from "../utils/serializers.js";
import { ethers } from "ethers";
import { BlockchainDisabledError, ensureBlockchainEnabled, registerLandOnChain } from "../services/landChainService.js";
import { landContract } from "../blockchain/landContract.js";

// GET all lands
export const getLands = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        lands.*,
        users.full_name as owner_name,
        users.email as owner_email
      FROM lands
      LEFT JOIN users ON lands.owner_id = users.id
      ORDER BY lands.created_at DESC
    `);
    res.json(result.rows.map(serializeLand));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch lands" });
  }
};

// GET lands by user
export const getLandsByUser = async (req, res) => {
  try {
    const userId = parseDbId(req.params.userId);
    
    const result = await pool.query(
      `SELECT 
        lands.*,
        users.full_name as owner_name,
        users.email as owner_email
      FROM lands
      LEFT JOIN users ON lands.owner_id = users.id
      WHERE lands.owner_id = $1
      ORDER BY lands.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows.map(serializeLand));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user lands" });
  }
};

// GET land by id (DB + blockchain)
export const getLandById = async (req, res) => {
  try {
    const landId = parseDbId(req.params.id);

    if (!landId) {
      return res.status(400).json({ error: "Invalid land id" });
    }

    console.log("Fetching land from DB", { landId });
    const dbResult = await pool.query(
      `SELECT
         lands.*,
         users.full_name as owner_name,
         users.email as owner_email
       FROM lands
       LEFT JOIN users ON lands.owner_id = users.id
       WHERE lands.id = $1
       LIMIT 1`,
      [landId]
    );

    const dbLand = dbResult.rows.length ? serializeLand(dbResult.rows[0]) : null;

    const shouldFetchBlockchain = !dbLand || Boolean(landContract);
    let chainLand = null;

    if (shouldFetchBlockchain && landContract) {
      try {
        console.log("Fetching land from blockchain", { landId });
        const chainData = await landContract.getLand(landId);
        chainLand = {
          landId: chainData[0].toString(),
          owner: chainData[1],
          documentHash: chainData[2],
        };
      } catch (chainError) {
        if (!dbLand) {
          return res.status(404).json({
            error: "Land not found in database or blockchain",
            details: chainError?.message || "Unknown blockchain error",
          });
        }
      }
    }

    if (!dbLand && !chainLand) {
      return res.status(404).json({ error: "Land not found" });
    }

    if (chainLand) {
      return res.json({
        landId: chainLand.landId,
        owner: chainLand.owner,
        location: dbLand?.location?.address || null,
        size: dbLand?.area ?? null,
        txHash: dbLand?.blockchainHash || null,
        source: "blockchain",
      });
    }

    return res.json({
      landId: String(dbLand.dbId || landId),
      owner: dbLand.owner,
      location: dbLand.location.address,
      size: dbLand.area,
      txHash: dbLand.blockchainHash || null,
      source: "database",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch land" });
  }
};

// POST create land
export const createLand = async (req, res) => {
  const client = await pool.connect();
  console.log("[controller][lands.create] entering controller", { bodyKeys: Object.keys(req.body || {}) });

  try {
    const { 
      title,
      land_name, 
      owner,
      location, 
      area,
      size, 
      coordinates,
      owner_id, 
      value,
      land_type, 
      description,
      documents,
      status,
      lastTransfer,
    } = req.body;

    const landName = title || land_name;
    const landLocation = typeof location === 'string' ? location : location?.address;
    const landCoordinates = coordinates || location?.coordinates || null;
    const landSize = area || size;
    const estimatedValue = value || req.body.estimated_value || 0;
    const landDocuments = Array.isArray(documents) ? documents : [];

    // Validate required fields
    if (!landName || !landLocation || !landSize || !(owner_id || owner)) {
      return res.status(400).json({ 
        error: "Missing required fields: title/land_name, location, area/size, owner" 
      });
    }

    const resolvedOwnerId = owner_id
      ? parseDbId(owner_id)
      : null;

    const ownerCheck = resolvedOwnerId
      ? await client.query("SELECT id FROM users WHERE id = $1", [resolvedOwnerId])
      : await client.query("SELECT id FROM users WHERE full_name = $1", [owner]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: "Owner user not found" });
    }

    try {
      ensureBlockchainEnabled();
    } catch (error) {
      if (error instanceof BlockchainDisabledError) {
        return res.status(503).json({
          error: error.message,
          diagnostics: error.diagnostics,
        });
      }

      throw error;
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO lands (
         land_name, location, size, coordinates, owner_id, land_type, description,
         estimated_value, documents, status, blockchain_hash, last_transfer
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        landName,
        landLocation,
        landSize,
        landCoordinates,
        ownerCheck.rows[0].id,
        land_type || 'general',
        description || '',
        estimatedValue,
        JSON.stringify(landDocuments),
        status || 'active',
        null,
        lastTransfer || new Date().toISOString(),
      ]
    );

    const createdLandDbId = result.rows[0].id;
    const documentHash = ethers.id(
      JSON.stringify({
        title: landName,
        location: landLocation,
        area: landSize,
        ownerId: ownerCheck.rows[0].id,
        documents: landDocuments,
      })
    );

    let txHash = null;
    try {
      console.log("[controller][lands.create] before blockchain call", { createdLandDbId });
      const chainResult = await registerLandOnChain({
        landId: createdLandDbId,
        documentHash,
        source: "controller.createLand",
      });
      txHash = chainResult.txHash;
      console.log("[controller][lands.create] after transaction is sent", {
        createdLandDbId,
        txHash,
        blockNumber: chainResult.receipt?.blockNumber || null,
      });

      if (!txHash) {
        throw new Error("Missing txHash after blockchain registration");
      }
    } catch (chainError) {
      await client.query("ROLLBACK");
      return res.status(502).json({
        error: "Failed to register land on blockchain",
        details: chainError?.message || "Unknown blockchain error",
      });
    }

    await client.query(
      `UPDATE lands
       SET blockchain_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [txHash, createdLandDbId]
    );

    const landResult = await client.query(
      `SELECT lands.*, users.full_name as owner_name
       FROM lands
       LEFT JOIN users ON lands.owner_id = users.id
       WHERE lands.id = $1`,
      [createdLandDbId]
    );

    await client.query("COMMIT");

    const payload = serializeLand(landResult.rows[0]);
    res.status(201).json({
      ...payload,
      txHash,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to create land" });
  } finally {
    client.release();
  }
};

// POST transfer land ownership
export const transferLandOwnership = async (req, res) => {
  try {
    const id = parseDbId(req.params.id);
    const { new_owner_id, transfer_reason } = req.body;

    if (!new_owner_id) {
      return res.status(400).json({ error: "new_owner_id is required" });
    }

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if land exists and get current owner
      const landCheck = await client.query(
        "SELECT * FROM lands WHERE id = $1",
        [id]
      );

      if (landCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Land not found" });
      }

      const land = landCheck.rows[0];

      // Check if new owner exists
      const newOwnerCheck = await client.query(
        "SELECT id, full_name FROM users WHERE id = $1",
        [new_owner_id]
      );

      if (newOwnerCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "New owner user not found" });
      }

      // Check if new owner is different from current owner
      if (land.owner_id === parseInt(new_owner_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "New owner is the same as current owner" 
        });
      }

      // Get current owner info
      const currentOwnerResult = await client.query(
        "SELECT full_name FROM users WHERE id = $1",
        [land.owner_id]
      );

      // Update land ownership
      const updateResult = await client.query(
        `UPDATE lands 
         SET owner_id = $1, status = 'active', last_transfer = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [new_owner_id, id]
      );

      // Record the transfer in a transfers table (if it exists)
      // This is optional but good practice for audit trail
      try {
        await client.query(
          `INSERT INTO land_transfers 
           (land_id, from_owner_id, to_owner_id, transfer_reason, status, completed_date, transfer_date)
           VALUES ($1, $2, $3, $4, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [id, land.owner_id, new_owner_id, transfer_reason || 'Ownership transfer']
        );
      } catch (transferLogError) {
        // If transfers table doesn't exist, continue anyway
        console.log("Transfer log table may not exist, skipping...");
      }

      await client.query('COMMIT');

      res.json({
        message: "Land ownership transferred successfully",
        land: serializeLand({
          ...updateResult.rows[0],
          owner_name: newOwnerCheck.rows[0].full_name,
        }),
        transfer_details: {
          from: currentOwnerResult.rows[0]?.full_name || "Unknown",
          to: newOwnerCheck.rows[0].full_name,
          reason: transfer_reason || "Ownership transfer"
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to transfer land ownership" });
  }
};
