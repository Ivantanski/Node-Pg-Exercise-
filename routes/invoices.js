/** Routes for invoices. */

const express = require("express");
const ExpressError = require("../expressError");
const db = require("../db");

const router = express.Router();

/** GET / => list of invoices.
 *
 * =>  {invoices: [{id, comp_code}, ...]}
 *
 */
router.get("/", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, comp_code
       FROM invoices 
       ORDER BY id`
    );
    return res.json({ invoices: result.rows });
  } catch (err) {
    return next(err);
  }
});

/** GET /[id] => detail on invoice
 *
 * =>  {invoices: {id, amt, paid, add_date, paid_date, company: {code, name, description}}}
 *
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT i.id, 
              i.comp_code, 
              i.amt, 
              i.paid, 
              i.add_date, 
              i.paid_date, 
              c.name, 
              c.description 
       FROM invoices AS i
         INNER JOIN companies AS c ON (i.comp_code = c.code)  
       WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new ExpressError(`No such invoice: ${id}`, 404);
    }

    const data = result.rows[0];
    const invoice = {
      id: data.id,
      amt: data.amt,
      paid: data.paid,
      add_date: data.add_date,
      paid_date: data.paid_date,
      company: {
        code: data.comp_code,
        name: data.name,
        description: data.description,
      }
    };

    return res.json({ invoice });
  } catch (err) {
    return next(err);
  }
});

/** POST / => add new invoice
 *
 * {comp_code, amt}  =>  {id, comp_code, amt, paid, add_date, paid_date}
 *
 */
router.post("/", async (req, res, next) => {
  try {
    const { comp_code, amt } = req.body;
    const result = await db.query(
      `INSERT INTO invoices (comp_code, amt) 
       VALUES ($1, $2) 
       RETURNING id, comp_code, amt, paid, add_date, paid_date`,
      [comp_code, amt]
    );
    return res.status(201).json({ invoice: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** PUT /[id] => update invoice
 *
 * {amt, paid}  =>  {id, comp_code, amt, paid, add_date, paid_date}
 *
 * If paying unpaid invoice, set paid_date; if marking as unpaid, clear paid_date.
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { amt, paid } = req.body;
    const { id } = req.params;

    const currResult = await db.query(
      `SELECT paid, paid_date
       FROM invoices
       WHERE id = $1`,
      [id]
    );

    if (currResult.rows.length === 0) {
      throw new ExpressError(`No such invoice: ${id}`, 404);
    }

    const currPaid = currResult.rows[0].paid;
    let paidDate = currResult.rows[0].paid_date;

    if (!currPaid && paid) {
      paidDate = new Date();
    } else if (!paid) {
      paidDate = null;
    }

    const result = await db.query(
      `UPDATE invoices
       SET amt=$1, paid=$2, paid_date=$3
       WHERE id=$4
       RETURNING id, comp_code, amt, paid, add_date, paid_date`,
      [amt, paid, paidDate, id]
    );

    return res.json({ invoice: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[id] => delete invoice
 *
 * => {status: "deleted"}
 *
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM invoices
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new ExpressError(`No such invoice: ${id}`, 404);
    }

    return res.json({ status: "deleted" });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
