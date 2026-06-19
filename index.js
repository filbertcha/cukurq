import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt from "bcrypt";

const app = express();
const port = 4000;
const saltRounds = 10;
env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

let services = [];
let barberman = [];

app.get("/services", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM services
      ORDER BY id
    `);
    services = result.rows;
    // console.log(services);
    res.json(services);
  } catch (err) {
    console.log(err);
  }
});

app.get("/services-customer", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM services
      WHERE is_active = 'ya'
    `);
    services = result.rows;
    // console.log(services);
    res.json(services);
  } catch (err) {
    console.log(err);
  }
});

app.get("/barberman", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE role = 'admin'");
    barberman = result.rows;
    // console.log(barberman);
    res.json(barberman);
  } catch (err) {
    console.log(err);
  }
});

app.get("/queues", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM queues");
    const antrian = result.rows;
    res.json(antrian);
  } catch (err) {
    console.log(err);
  }
});

app.get("/queues-history", async (req, res) => {
  try {
    const user_id = parseInt(req.query.user_id);

    const result = await db.query(
      `
      SELECT
          q.id,
          q.queue_number,
          q.status,
          q.queue_date,
          s.name AS service_name

      FROM queues q

      JOIN services s
          ON q.service_id = s.id

      WHERE q.user_id = $1

      ORDER BY q.queue_date DESC
      `,
      [user_id],
    );

    const riwayatAntrian = result.rows;

    res.json(riwayatAntrian);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

app.get("/profile", async (req, res) => {
  try {
    const user_id = parseInt(req.query.user_id);
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    const profile = result.rows[0];
    // console.log(profile);
    res.json(profile);
  } catch (err) {
    console.log(err);
  }
});

app.get("/admin/queues", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        q.id,
        q.queue_number,
        q.status,
        q.queue_date,

        u.id AS user_id,
        u.name AS customer_name,
        u.nomor_hp,

        s.id AS service_id,
        s.name AS service_name

      FROM queues q

      JOIN users u
        ON q.user_id = u.id

      JOIN services s
        ON q.service_id = s.id

      ORDER BY q.created_at ASC
    `);
    // console.log(result.rows);
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        id,
        name,
        nomor_hp,
        role
      FROM users
      ORDER BY id
      `,
    );
    const users = result.rows;
    res.json(users);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

app.post("/register", async (req, res) => {
  const nama = req.body.nama;
  const nohp = req.body.nohp;
  const password = req.body.password;
  try {
    const checkResult = await db.query(
      "SELECT * FROM users WHERE nomor_hp = $1",
      [nohp],
    );

    if (checkResult.rows.length > 0) {
      res.send("Nomor HP alredy exists.");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log(err);
        } else {
          const result = await db.query(
            "INSERT INTO users (name, nomor_hp, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
            [nama, nohp, hash, "customer"],
          );
          const user = result.rows[0];
          res.json({ register: true, user: user });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/login", async (req, res) => {
  const nohp = req.body.nohp;
  const loginPassword = req.body.password;
  try {
    const checkResult = await db.query(
      "SELECT * FROM users WHERE nomor_hp = $1",
      [nohp],
    );

    if (checkResult.rows.length > 0) {
      const user = checkResult.rows[0];
      const storedHashedPassword = user.password;

      bcrypt.compare(loginPassword, storedHashedPassword, (err, result) => {
        if (err) {
          console.log(err);
          res.json({ error: err });
        } else {
          if (result) {
            res.json({ password: true, user: user });
          } else {
            res.json({ password: false, user: user });
          }
        }
      });
    } else {
      res.json({ user: false });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: err });
  }
});

app.post("/queues", async (req, res) => {
  try {
    const userId = req.body.user_id;
    const serviceId = req.body.service_id;

    // cek apakah user masih punya antrian aktif
    const existingQueue = await db.query(
      `
      SELECT *
      FROM queues
      WHERE user_id = $1
      AND service_id = $2
      AND status NOT IN ('DONE', 'REJECTED')
      `,
      [userId, serviceId],
    );

    if (existingQueue.rows.length > 0) {
      return res.json({
        err: "Anda masih memiliki antrian aktif",
        queue_number: null,
      });
    }

    // cari nomor antrian terakhir
    const lastQueue = await db.query(
      `
      SELECT queue_number
      FROM queues
      WHERE service_id = $1
      ORDER BY queue_number DESC
      LIMIT 1
      `,
      [serviceId],
    );

    let nextQueueNumber = 1;

    if (lastQueue.rows.length > 0) {
      nextQueueNumber = lastQueue.rows[0].queue_number + 1;
    }

    // simpan antrian baru
    await db.query(
      `
      INSERT INTO queues (
        queue_number,
        user_id,
        service_id,
        queue_date,
        status
      )
      VALUES ($1, $2, $3, NOW(), 'Antri')
      `,
      [nextQueueNumber, userId, serviceId],
    );

    res.json({
      queue_number: nextQueueNumber,
      user: userId,
      service: serviceId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan");
  }
});

app.post("/services", async (req, res) => {
  try {
    const addService = await db.query(
      `
      INSERT INTO services (
        name,
        duration_minutes,
        price,
        is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        'ya'
      )
      RETURNING *;
      `,
      [req.body.name, req.body.duration_minutes, req.body.price],
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);
  }
});

app.patch("/profile/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const nama = req.body.nama;
    const nohp = req.body.nohp;
    const password = req.body.password;

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);

      const updateProfile = await db.query(
        `
        UPDATE users
        SET
          name = $1,
          nomor_hp = $2,
          password = $3
        WHERE id = $4
        `,
        [nama, nohp, hashedPassword, userId],
      );
    } else {
      const updateProfile = await db.query(
        `
        UPDATE users
        SET
          name = $1,
          nomor_hp = $2
        WHERE id = $3
        `,
        [nama, nohp, userId],
      );
    }

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Update gagal");
  }
});

app.patch("/queues/:id", async (req, res) => {
  try {
    const updateQueue = await db.query(
      `
      UPDATE queues
      SET status = $1
      WHERE id = $2
      `,
      [req.body.status, req.params.id],
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    res.status(500).send("Error");
  }
});

app.patch("/services/:id", async (req, res) => {
  try {
    const updateService = await db.query(
      `
      UPDATE services
      SET
        duration_minutes = $1,
        price = $2
      WHERE id = $3
      `,
      [req.body.duration_minutes, req.body.price, req.params.id],
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);
  }
});

app.patch("/services/:id/toggle", async (req, res) => {
  try {
    const service = await db.query(
      `
          SELECT is_active
          FROM services
          WHERE id = $1
          `,
      [req.params.id],
    );

    const currentStatus = service.rows[0].is_active;

    let newStatus;

    if (currentStatus === "ya") {
      newStatus = "tidak";
    } else {
      newStatus = "ya";
    }

    await db.query(
      `
        UPDATE services
        SET is_active = $1
        WHERE id = $2
        `,
      [newStatus, req.params.id],
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);
  }
});

app.patch("/users/:id/role", async (req, res) => {
  try {
    const updateRole = await db.query(
      `
        UPDATE users
        SET role = $1
        WHERE id = $2
        `,
      [req.body.role, req.params.id],
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.log(err);

    res.status(500).send("Error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
