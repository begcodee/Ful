import pool from "../config/db.js";

export const getPayments = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

export const createPayment = async (req, res) => {
  try {
    const { transaction_id, payer_id, amount, method, status } = req.body;
    if (!transaction_id || !payer_id || !amount) {
      return res.status(400).json({ error: 'transaction_id, payer_id and amount are required' });
    }

    const result = await pool.query(
      `INSERT INTO payments (transaction_id, payer_id, amount, method, status, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [transaction_id, payer_id, amount, method || 'card', status || 'pending']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id and status are required' });

    const result = await pool.query(
      'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
};
