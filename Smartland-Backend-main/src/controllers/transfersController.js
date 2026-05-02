import pool from "../config/db.js";
import { parseDbId, serializeTransfer } from "../utils/serializers.js";
import { landContract } from "../blockchain/landContract.js";
import { ethers } from "ethers";

const resolveUser = async (client, identityValue) => {
  if (!identityValue) return null;

  const input = String(identityValue).trim();
  const looksLikePrefixedUserId = /^U\d+$/i.test(input);
  const looksLikeNumericId = /^\d+$/.test(input);
  const parsedId = looksLikePrefixedUserId || looksLikeNumericId
    ? parseDbId(input)
    : null;
  const normalizedWallet = input.toLowerCase();

  const result = await client.query(
    `SELECT id, full_name, wallet_address
     FROM users
     WHERE id = $1
        OR lower(full_name) = lower($2)
        OR lower(wallet_address) = $3
     ORDER BY CASE
       WHEN id = $1 THEN 1
       WHEN lower(full_name) = lower($2) THEN 2
       WHEN lower(wallet_address) = $3 THEN 3
       ELSE 4
     END
     LIMIT 1`,
    [Number.isFinite(parsedId) ? parsedId : -1, input, normalizedWallet]
  );

  return result.rows[0] || null;
};

const getTransferById = async (client, transferId) => {
  const result = await client.query(
    `SELECT 
       lt.*,
       from_user.full_name AS from_owner_name,
       from_user.wallet_address AS from_owner_wallet,
       to_user.full_name AS to_owner_name,
       to_user.wallet_address AS to_owner_wallet
     FROM land_transfers lt
     LEFT JOIN users from_user ON lt.from_owner_id = from_user.id
     LEFT JOIN users to_user ON lt.to_owner_id = to_user.id
     WHERE lt.id = $1`,
    [transferId]
  );

  return result.rows[0];
};

export const getTransfers = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         lt.*,
         from_user.full_name AS from_owner_name,
         to_user.full_name AS to_owner_name
       FROM land_transfers lt
       LEFT JOIN users from_user ON lt.from_owner_id = from_user.id
       LEFT JOIN users to_user ON lt.to_owner_id = to_user.id
       ORDER BY lt.initiated_date DESC, lt.id DESC`
    );

    res.json(result.rows.map(serializeTransfer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
};

export const createTransfer = async (req, res) => {
  const client = await pool.connect();

  try {
    const { landParcelId, from, to, amount, transferReason, escrowHash } = req.body;
    const landId = parseDbId(landParcelId);

    if (!landId || !from || !to) {
      return res.status(400).json({ error: "landParcelId, from, and to are required" });
    }

    await client.query("BEGIN");

    const landResult = await client.query("SELECT * FROM lands WHERE id = $1", [landId]);
    if (landResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Land not found" });
    }

    const fromUser = await resolveUser(client, from);
    const toUser = await resolveUser(client, to);

    if (!fromUser || !toUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transfer users not found. Use name, user ID (e.g., U001), DB ID, or wallet address." });
    }

    const insertResult = await client.query(
      `INSERT INTO land_transfers (
         land_id, from_owner_id, to_owner_id, amount, transfer_reason, status, escrow_hash, initiated_date, transfer_date
       )
       VALUES ($1, $2, $3, $4, $5, 'escrowed', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        landId,
        fromUser.id,
        toUser.id,
        amount || 0,
        transferReason || 'Ownership transfer initiated',
        escrowHash || null,
      ]
    );

    await client.query(
      `UPDATE lands
       SET status = 'transfer_pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [landId]
    );

    await client.query("COMMIT");

    const transfer = await getTransferById(client, insertResult.rows[0].id);
    res.status(201).json(serializeTransfer(transfer));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to create transfer" });
  } finally {
    client.release();
  }
};

export const completeTransfer = async (req, res) => {
  const client = await pool.connect();

  try {
    const transferId = parseDbId(req.params.id);
    const { txHash: providedTxHash, skipBlockchain } = req.body || {};

    await client.query("BEGIN");
    const transfer = await getTransferById(client, transferId);

    if (!transfer) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transfer not found" });
    }

    let txHash = null;
    const shouldSkipBlockchain = Boolean(skipBlockchain && providedTxHash);

    if (shouldSkipBlockchain) {
      txHash = String(providedTxHash);
    } else {
      if (!landContract) {
        await client.query("ROLLBACK");
        return res.status(503).json({ error: "Blockchain contract is not configured on this server" });
      }

      if (!transfer.to_owner_wallet || !ethers.isAddress(transfer.to_owner_wallet)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Target owner wallet address is missing or invalid" });
      }

      try {
        const tx = await landContract.transferLand(transfer.land_id, transfer.to_owner_wallet);
        const receipt = await tx.wait();
        txHash = receipt?.hash || tx?.hash || null;
      } catch (chainError) {
        await client.query("ROLLBACK");
        return res.status(502).json({
          error: "Failed to transfer land on blockchain",
          details: chainError?.message || "Unknown blockchain error",
        });
      }
    }

    const updatedTransfer = await client.query(
      `UPDATE land_transfers
       SET status = 'completed', completed_date = CURRENT_TIMESTAMP, transfer_date = CURRENT_TIMESTAMP, escrow_hash = COALESCE($2, escrow_hash)
       WHERE id = $1
       RETURNING *`,
      [transferId, txHash]
    );

    await client.query(
      `UPDATE lands
       SET owner_id = $1, status = 'active', last_transfer = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [transfer.to_owner_id, transfer.land_id]
    );

    await client.query("COMMIT");

    const result = await getTransferById(client, updatedTransfer.rows[0].id);
    res.json(serializeTransfer(result));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to complete transfer" });
  } finally {
    client.release();
  }
};

export const cancelTransfer = async (req, res) => {
  const client = await pool.connect();

  try {
    const transferId = parseDbId(req.params.id);

    await client.query("BEGIN");
    const transfer = await getTransferById(client, transferId);

    if (!transfer) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transfer not found" });
    }

    await client.query(
      `UPDATE land_transfers
       SET status = 'cancelled', transfer_date = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [transferId]
    );

    await client.query(
      `UPDATE lands
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [transfer.land_id]
    );

    await client.query("COMMIT");

    const result = await getTransferById(client, transferId);
    res.json(serializeTransfer(result));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to cancel transfer" });
  } finally {
    client.release();
  }
};
