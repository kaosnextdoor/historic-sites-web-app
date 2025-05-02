const siteData = require("./modules/data-service");
const authData = require("./modules/auth-service");
const express = require("express")
const clientSessions = require("client-sessions");
const app = express();
const HTTP_PORT = process.env.PORT || 8080;

require('dotenv').config();

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));

app.use(clientSessions({
  cookieName: 'session',
  secret: 'o6LjQ5EVNC28ZgK64hDELM18ScpFQr',
  duration: 2 * 60 * 1000,
  activeDuration: 1000 * 60
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

app.set('views', __dirname + '/views');
app.set("view engine", "ejs");

siteData.initialize()
  .then(authData.initialize)
  .then(() => {
    app.listen(HTTP_PORT, () => {
      console.log(`Server listening on ${HTTP_PORT}`);
    });
  }).catch(err => {
    console.log(`unable to start server: ${err}`);
  });

app.get("/", (req, res) => {
  res.render("home", { page: "/" });
});

app.get("/about", (req, res) => {
  res.render("about", { page: "/about" });
});

app.get("/sites", async (req, res) => {
  try {
    let sites;
    if (req.query.region) {
      sites = await siteData.getSitesByRegion(req.query.region);
    } else if (req.query.provinceOrTerritory) {
      sites = await siteData.getSitesBySubRegion(req.query.provinceOrTerritory);
    } else {
      sites = await siteData.getAllSites();
    }

    res.render("sites", { sites, page: "/sites" });
  } catch (error) {
    res.status(404).render("404", { message: "No matching sites found." });
  }
});

app.get("/sites/:id", async (req, res) => {
  try {
    const site = await siteData.getSiteById(req.params.id);
    res.render("site", { site });
  } catch (error) {
    res.status(404).render("404", { message: error.message || error });
  }
});

app.get("/addSite", ensureLogin, (req, res) => {
  siteData.getAllProvincesAndTerritories()
    .then(provincesAndTerritories => {
      res.render("addSite", { provincesAndTerritories });
    })
    .catch(err => {
      res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.post("/addSite", ensureLogin, (req, res) => {
  siteData.addSite(req.body)
    .then(() => res.redirect("/sites"))
    .catch(err => {
      res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.get("/editSite/:id", ensureLogin, (req, res) => {
  siteData.getSiteById(req.params.id)
    .then(site => {
      siteData.getAllProvincesAndTerritories()
        .then(provincesAndTerritories => {
          res.render("editSite", { site, provincesAndTerritories });
        })
        .catch(err => {
          res.status(404).render("404", { message: err });
        });
    })
    .catch(err => {
      res.status(404).render("404", { message: err });
    });
});

app.post("/editSite", ensureLogin, (req, res) => {
  siteData.editSite(req.body.id, req.body)
    .then(() => res.redirect("/sites"))
    .catch(err => {
      res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.get("/deleteSite/:id", ensureLogin, (req, res) => {
  siteData.deleteSite(req.params.id)
    .then(() => res.redirect("/sites"))
    .catch(err => {
      res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
    });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  authData.checkUser(req.body).then((user) => {
    req.session.user = {
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory
    };
    res.redirect("/sites");
  }).catch(err => {
    res.render("login", { errorMessage: err, userName: req.body.userName });
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  authData.registerUser(req.body).then(() => {
    res.render("register", { successMessage: "User created" });
  }).catch(err => {
    res.render("register", { errorMessage: err, userName: req.body.userName });
  });
});

app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
  res.render("userHistory");
});

app.use((req, res) => {
  res.status(404).render("404", { message: "Page not found" });
});
