import pool from "../config/db.js";

export const castVote = async (req, res) => {
  try {
    const { dispute_id, disputeId, user_id, userId, vote } = req.body;
    const disputeIdResolved = Number(dispute_id || disputeId);
    const voterId = Number(user_id || userId);

    if (!disputeIdResolved || !voterId || !['support', 'against', 'abstain'].includes(vote)) {
      return res.status(400).json({ error: 'dispute_id, user_id and valid vote are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dispute = await client.query('SELECT id FROM disputes WHERE id = $1', [disputeIdResolved]);
      if (dispute.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Dispute not found' });
      }

      // Prevent duplicate voting via unique constraint check
      const existing = await client.query('SELECT id FROM votes WHERE dispute_id = $1 AND user_id = $2', [disputeIdResolved, voterId]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'User has already voted' });
      }

      await client.query(
        'INSERT INTO votes (dispute_id, user_id, vote_type) VALUES ($1, $2, $3)',
        [disputeIdResolved, voterId, vote]
      );

      // Recalculate counts
      const counts = await client.query(
        `SELECT
           COALESCE(SUM(CASE WHEN vote_type = 'support' THEN 1 ELSE 0 END), 0) AS support,
           COALESCE(SUM(CASE WHEN vote_type = 'against' THEN 1 ELSE 0 END), 0) AS against,
           COALESCE(SUM(CASE WHEN vote_type = 'abstain' THEN 1 ELSE 0 END), 0) AS abstain
         FROM votes WHERE dispute_id = $1`,
        [disputeIdResolved]
      );

      const votesObj = {
        support: Number(counts.rows[0].support || 0),
        against: Number(counts.rows[0].against || 0),
        abstain: Number(counts.rows[0].abstain || 0),
      };

      await client.query(
        'UPDATE disputes SET votes = $1, status = CASE WHEN status = \'' +
          "pending" + "' THEN 'community_voting' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [votesObj, disputeIdResolved]
      );

      await client.query('COMMIT');

      return res.json({ dispute_id: disputeIdResolved, votes: votesObj });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
};

export const getVoteResults = async (req, res) => {
  try {
    const disputeId = Number(req.params.disputeId || req.query.dispute_id);
    if (!disputeId) return res.status(400).json({ error: 'disputeId is required' });

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN vote_type = 'support' THEN 1 ELSE 0 END), 0) AS support,
         COALESCE(SUM(CASE WHEN vote_type = 'against' THEN 1 ELSE 0 END), 0) AS against,
         COALESCE(SUM(CASE WHEN vote_type = 'abstain' THEN 1 ELSE 0 END), 0) AS abstain
       FROM votes WHERE dispute_id = $1`,
      [disputeId]
    );

    const votes = {
      support: Number(result.rows[0].support || 0),
      against: Number(result.rows[0].against || 0),
      abstain: Number(result.rows[0].abstain || 0),
    };

    res.json({ dispute_id: disputeId, votes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch vote results' });
  }
};
