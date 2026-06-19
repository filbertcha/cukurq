import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import env from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";

env.config();
const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

function isAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const allowedRoles = ["admin", "super admin"];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).send("Akses ditolak");
  }

  next();
}

function isSuperAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  if (req.user.role !== "super admin") {
    return res.status(403).send("Akses ditolak");
  }

  next();
}

app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const adminRoles = ["admin", "super admin"];

    if (adminRoles.includes(req.user.role)) {
      return res.redirect("/admin");
    }

    const servicesRes = await axios.get(`${API_URL}/services-customer`);
    const antrianRes = await axios.get(`${API_URL}/queues`);

    const services = servicesRes.data;
    const queues = antrianRes.data;

    const activeQueues = queues.filter((queue) => {
      return queue.status !== "Selesai" && queue.status !== "Ditolak";
    });

    const servicesWithQueues = [];

    for (let i = 0; i < services.length; i++) {
      const service = services[i];

      const queuesForThisService = [];

      for (let j = 0; j < activeQueues.length; j++) {
        const queue = activeQueues[j];

        if (queue.service_id === service.id) {
          queuesForThisService.push(queue);
        }
      }

      servicesWithQueues.push({
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price,
        is_active: service.is_active,

        queues: queuesForThisService.length,
      });
    }

    res.render("home.ejs", {
      services: servicesWithQueues,
    });
  } else {
    try {
      const services = await axios.get(`${API_URL}/services-customer`);
      // console.log(services);
      const barberman = await axios.get(`${API_URL}/barberman`);
      // console.log(barberman.data);
      res.render("index.ejs", {
        listServices: services.data,
        listBarberman: barberman.data,
      });
    } catch (err) {
      console.log(err);
    }
  }
});

app.get("/admin", isAdmin, async (req, res) => {
  const response = await axios.get(`${API_URL}/admin/queues`);
  // console.log(response.data);
  res.render("admin.ejs", {
    queues: response.data,
    profile: req.user,
  });
});

app.get("/login", async (req, res) => {
  res.render("login.ejs");
});

app.get("/register", async (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/riwayatAntrian", async (req, res) => {
  try {
    const queues = await axios.get(`${API_URL}/queues-history`, {
      params: {
        user_id: req.user.id,
      },
    });
    res.render("riwayatAntrian.ejs", { riwayatAntrian: queues.data });
  } catch (err) {
    console.log(err);
  }
});

app.get("/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    // console.log(req.user.id);
    const profileRes = await axios.get(`${API_URL}/profile`, {
      params: {
        user_id: req.user.id,
      },
    });
    const profile = profileRes.data;
    // console.log(profile);
    res.render("profile.ejs", { profile: profile });
  } else {
    res.redirect("/");
  }
});

app.get("/admin/services", isAdmin, async (req, res) => {
  const response = await axios.get(`${API_URL}/services`);

  res.render("admin-services.ejs", {
    services: response.data,
    profile: req.user,
  });
});

app.get("/role", isSuperAdmin, async (req, res) => {
  const response = await axios.get(`${API_URL}/users`);

  res.render("role.ejs", {
    users: response.data,
  });
});

app.post("/api/register", async (req, res) => {
  const nama = req.body.nama;
  const nohp = req.body.nohp;
  const password = req.body.password;
  const response = await axios.post(`${API_URL}/register`, {
    nama: nama,
    nohp: nohp,
    password: password,
  });
  const result = response.data;
  // console.log(response.data);

  if (result.register === true) {
    req.login(result.user, (err) => {
      console.log("success");
      res.redirect("/");
    });
  } else {
    res.send(result);
  }
});

app.post(
  "/api/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
);

app.post("/mengantri/:serviceId", async (req, res) => {
  try {
    // console.log(req.user);
    const response = await axios.post(`${API_URL}/queues`, {
      user_id: req.user.id,
      service_id: req.params.serviceId,
    });

    const result = response.data;
    // console.log(result);
    // console.log(result.queue_number !== null);

    if (result.queue_number != null) {
      // res.send("Berhasil");
      res.render("success.ejs", {
        no_antrian: result.queue_number,
      });
    } else {
      res.send(result.err);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Gagal mengambil antrian");
  }
});

app.post("/profile/:id", async (req, res) => {
  try {
    const response = await axios.patch(`${API_URL}/profile/${req.params.id}`, {
      nama: req.body.nama,
      nohp: req.body.nohp,
      password: req.body.password,
    });

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send("Gagal update profile");
  }
});

app.post("/admin/queue/:id/status", isAdmin, async (req, res) => {
  const response = await axios.patch(`${API_URL}/queues/${req.params.id}`, {
    status: req.body.status,
  });

  res.redirect("/admin");
});

app.post("/admin/services", isAdmin, async (req, res) => {
  const response = await axios.post(`${API_URL}/services`, {
    name: req.body.name,
    duration_minutes: req.body.duration_minutes,
    price: req.body.price,
  });

  res.redirect("/admin/services");
});

app.post("/admin/services/:id/update", isAdmin, async (req, res) => {
  const response = await axios.patch(`${API_URL}/services/${req.params.id}`, {
    duration_minutes: req.body.duration_minutes,
    price: req.body.price,
  });

  res.redirect("/admin/services");
});

app.post("/admin/services/:id/toggle", isAdmin, async (req, res) => {
  const response = await axios.patch(
    `${API_URL}/services/${req.params.id}/toggle`,
  );

  res.redirect("/admin/services");
});

app.post("/role/:id", isSuperAdmin, async (req, res) => {
  const response = await axios.patch(`${API_URL}/users/${req.params.id}/role`, {
    role: req.body.role,
  });

  res.redirect("/role");
});

passport.use(
  "local",
  new Strategy(
    {
      usernameField: "nohp",
      passwordField: "password",
    },
    async function verify(nohp, password, cb) {
      try {
        const response = await axios.post(`${API_URL}/login`, {
          nohp: nohp,
          password: password,
        });
        // console.log(response.data);
        const result = response.data;

        // console.log(result);
        // console.log(result.user);
        if (result.password === true) {
          return cb(null, result.user);
        } else if (result.password === false) {
          return cb(null, false);
        } else if (result.user === false) {
          return cb("User not found");
        } else {
          return cb(result.error);
        }
      } catch (err) {
        console.log(err);
      }
    },
  ),
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
