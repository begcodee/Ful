import pool from "../config/db.js";
import { parseDbId, serializeDispute } from "../utils/serializers.js";

const getDisputeRow = async (client, disputeId) => {
  const result = await client.query("SELECT * FROM disputes WHERE id = $1", [disputeId]);
  return result.rows[0];
};

const getVoteCounts = async (client, disputeId) => {
  const result = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN vote_type = 'support' THEN 1 ELSE 0 END), 0) AS support,
       COALESCE(SUM(CASE WHEN vote_type = 'against' THEN 1 ELSE 0 END), 0) AS against,
       COALESCE(SUM(CASE WHEN vote_type = 'abstain' THEN 1 ELSE 0 END), 0) AS abstain
     FROM votes
     WHERE dispute_id = $1`,
    [disputeId]
  );

  return {
    support: Number(result.rows[0].support || 0),
    against: Number(result.rows[0].against || 0),
    abstain: Number(result.rows[0].abstain || 0),
  };
};

export const getDisputes = async (_req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM disputes ORDER BY filed_date DESC, id DESC");

    const disputes = [];
    for (const row of result.rows) {
      disputes.push({
        ...row,
        votes: await getVoteCounts(client, row.id),
      });
    }

    res.json(disputes.map(serializeDispute));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch disputes" });
  } finally {
    client.release();
  }
};

export const createDispute = async (req, res) => {
  const client = await pool.connect();

  try {
    const { landParcelId, plaintiff, defendant, description, evidence, arbitrator } = req.body;
    const landId = parseDbId(landParcelId);

    if (!landId || !plaintiff || !defendant || !description) {
      return res.status(400).json({ error: "landParcelId, plaintiff, defendant, and description are required" });
    }

    await client.query("BEGIN");

    const landResult = await client.query("SELECT id FROM lands WHERE id = $1", [landId]);
    if (landResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Land not found" });
    }

    const result = await client.query(
      `INSERT INTO disputes (
         land_id, plaintiff_name, defendant_name, description, evidence, status, votes, arbitrator, filed_date, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        landId,
        plaintiff,
        defendant,
        description,
        evidence || [],
        { support: 0, against: 0, abstain: 0 },
        arbitrator || null,
      ]
    );

    await client.query(
      `UPDATE lands
       SET status = 'disputed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [landId]
    );

    await client.query("COMMIT");
    res.status(201).json(serializeDispute(result.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to create dispute" });
  } finally {
    client.release();
  }
};

export const voteOnDispute = async (req, res) => {
  const client = await pool.connect();
  try {
    const disputeId = parseDbId(req.params.id);
    const { vote, userId, user_id } = req.body;
    const voterId = parseDbId(userId || user_id);

    console.log("User attempting vote", { disputeId, voterId, vote });

    if (!["support", "against", "abstain"].includes(vote)) {
      return res.status(400).json({ error: "Vote must be support, against, or abstain" });
    }

    if (!voterId) {
      return res.status(400).json({ error: "userId is required" });
    }

    await client.query("BEGIN");

    const current = await client.query("SELECT * FROM disputes WHERE id = $1", [disputeId]);
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Dispute not found" });
    }

    const existingVote = await client.query(
      "SELECT * FROM votes WHERE dispute_id = $1 AND user_id = $2",
      [disputeId, voterId]
    );

    if (existingVote.rows.length > 0) {
      await client.query("ROLLBACK");
      console.log("Vote rejected (already voted)", { disputeId, voterId });
      return res.status(409).json({ error: "User has already voted" });
    }

    await client.query(
      `INSERT INTO votes (dispute_id, user_id, vote_type)
       VALUES ($1, $2, $3)`,
      [disputeId, voterId, vote]
    );

    const votes = await getVoteCounts(client, disputeId);

    const result = await client.query(
      `UPDATE disputes
       SET votes = $1, status = CASE WHEN status = 'pending' THEN 'community_voting' ELSE status END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [votes, disputeId]
    );

    await client.query("COMMIT");

    console.log("Vote recorded successfully", { disputeId, voterId, vote });

    res.json(serializeDispute(result.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to vote on dispute" });
  } finally {
    client.release();
  }
};

export const resolveDispute = async (req, res) => {
  const client = await pool.connect();

  try {
    const disputeId = parseDbId(req.params.id);
    const { resolution, arbitrator } = req.body;

    await client.query("BEGIN");
    const dispute = await getDisputeRow(client, disputeId);

    if (!dispute) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Dispute not found" });
    }

    const result = await client.query(
      `UPDATE disputes
       SET status = 'resolved', resolution = $1, arbitrator = COALESCE($2, arbitrator), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [resolution || 'Resolved by system', arbitrator || null, disputeId]
    );

    await client.query(
      `UPDATE lands
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [dispute.land_id]
    );

    await client.query("COMMIT");
    res.json(serializeDispute(result.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to resolve dispute" });
  } finally {
    client.release();
  }
};
