// Created by: Parth Vasdewani

//APIs
import mysql from "mysql";
import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
// import bodyParser from "body-parser";

// Specify path to environmental variables
dotenv.config({ path: "./.env" });

// Assigning port
const PORT = process.env.PORT;

// Creating connection with our database
const dbConnection = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD
});

// Checking database connection
dbConnection.connect((err) => {
    if (err) {
        return console.error("error: " + err.message);
    }
    console.log("Connected to the MySQL Server");
});

// Initialising Express
const app = express();

// Associating modules required along with Express
// The secret variable is used to secure session data
app.use(session({
    secret: "secret",
    resave: true,
    saveUninitialized: true
}))

// The json and urlencoded methods will extract the form data from our html file.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser);

app.set("view engine", ".hbs");

// Other imports
import path from "path";
const __dirname = path.resolve();
const publicDir = path.join(__dirname, "./public");
app.use(express.static(publicDir));


// Index page to be displayed to client upon creating new connection
app.get("/", async (req, res) => {
    if (req.session.loggedin) {
        dbConnection.query("SELECT * FROM tasks WHERE user_id=? AND is_completed = false ORDER BY task_id DESC LIMIT 5", [req.session.userId], (error, results, fields) => {
            if (error) throw error;
            else if (results.length === 0) {
                return res.render("index", { success: true, message: "Track tasks seamlessly", newTask: "No tasks are available in record!!!" })
            }
            else {
                return res.render("index", { success: true, message: "Track tasks seamlessly", results });
            }
        }
        )

    } else {
        const message = "Looks like you are not signed in!! Sign in to create and manage the tasks!!"
        res.render("index", { success: false, message: message });
    }
});

// Show active tasks to user
app.get("/active_tasks", (req, res) => {
    if (req.session.loggedin) {
        dbConnection.query("SELECT * FROM tasks WHERE user_id=? AND is_completed = false ORDER BY task_id DESC", [req.session.userId], (error, results, fields) => {
            if (error) throw error;
            else if (results.length === 0) {
                return res.render("active_tasks", { message: `No active tasks are available in record!!! ${req.session.userName}` })
            }
            else {
                return res.render("active_tasks", { success: true, message: "Track tasks seamlessly", results });
            }
        }
        )
    }
});

// Show completed tasks to user
app.get("/completed_tasks", (req, res) => {
    if (req.session.loggedin) {
        dbConnection.query("SELECT * FROM tasks WHERE user_id=? AND is_completed = true ORDER BY task_id DESC", [req.session.userId], (error, results, fields) => {
            if (error) throw error;
            else if (results.length === 0) {
                return res.render("active_tasks", { message: `No completed tasks are available in record!!! ${req.session.userName}` })
            }
            else {
                return res.render("active_tasks", { success: true, message: "Track tasks seamlessly", results });
            }
        }
        )
    }
});

// Adding route to logout user and destroy the session
app.post("/logout", (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                res.status(400).send("Unable to log out");
            } else {
                res.render("index", { success: false, message: "Looks like you are not signed in!!" });
            }
        })
    } else {
        res.end();
    }
});

// Registering user 
app.post("/auth/register", (req, res) => {
    var firstName = req.body.registerFirstName;
    var lastName = req.body.registerLastName;
    var email = req.body.registerEmail;
    var userName = req.body.registerUsername;
    var plainTextPassword = req.body.registerPassword;
    var confirmPassword = req.body.confirmPassword;

    // Execute SELECT query to check the existence of registered user in database based on specified email
    dbConnection.query("SELECT * FROM user WHERE email=? AND username=?", [email, userName], async (error, results, fields) => {
        // If there is an issue with query
        if (error) throw error;
        // Check if user already exists
        if (results.length > 0) {
            return res.render("index", { message: "User already exists!!" });
        }
        else if (plainTextPassword !== confirmPassword) {
            return res.render("index", { message: "Passwords donot match!!" });
        }
        else {
            // Registering new user and inserting data into database
            let hash = await bcrypt.hash(plainTextPassword, 8);
            dbConnection.query("INSERT INTO user SET?", { firstname: firstName, lastname: lastName, email: email, username: userName, password: hash }, async (error, results, fields) => {
                if (error) throw error;
                else {
                    req.session.loggedin = true;
                    return res.render("index", { message: "Welcome to the team!!", success: true });
                }
            });
        }

    });
});

// Signing in existing user and authenticating same
app.post("/auth/login", (req, res) => {
    // Capture the input fields
    var userName = req.body.loginUsername;
    var plainTextPassword = req.body.loginPassword;

    // Ensuring data has been field
    if (userName && plainTextPassword) {
        dbConnection.query("SELECT * FROM user WHERE username=?", [userName], async (error, results, fields) => {
            // If there is any error with the query
            if (error) throw error;

            else if (results.length > 0) {
                // Authenticate user
                let result = await bcrypt.compare(plainTextPassword, results[0].password);
                if (result) {
                    req.session.loggedin = true;
                    req.session.userId = results[0].user_id;
                    req.session.userName = results[0].firstname;
                    console.log("User has successfully logged in");
                    res.redirect("/");
                } else {
                    return res.render("index", { success: false, message: "Incorrect password!!" });
                }
            }

            else {
                return res.render("index", { success: false, message: "User doesn't exists" });
            }
        });
    }
});

// Adding tasks
app.post("/new/task", async (req, res) => {
    if (req.session.loggedin) {
        var newTask = await req.body.newTask;
        // Check if task has been entered
        if (newTask) {
            dbConnection.query("INSERT INTO tasks SET?", { task_name: newTask, user_id: req.session.userId }, (error, results, fields) => {
                if (error) throw error;
                console.log("Record inserted successfully!!");
            });
            dbConnection.query("SELECT * FROM tasks WHERE user_id=? ORDER BY task_id DESC", [req.session.userId], async (error, results, fields) => {
                var task_name = results[0].task_name;
                return res.redirect("/");
            });
        } else {
            return res.render("index", { message: "Cannot create an empty task!!" });
        }
    } else {
        return res.render("index", { message: "User must be logged in to create task!!" });
    }
});


// Task Actions:- Mark Task as Complete
app.post("/task/action/", async (req, res) => {
    var btnValue = await req.body.submit;
    var task_id = await req.body.task_id;
    if (btnValue === "setComplete") {
        dbConnection.query("UPDATE tasks SET is_completed = true WHERE task_id=?", [task_id], (error, results, fields) => {
            if (error) throw error;
            else if (results) {
                res.redirect("/");
            }
            else {
                res.send("Cannot find task in database!!");
            }
        });
    }
    else if (btnValue === "doDelete") {
        dbConnection.query("DELETE FROM tasks WHERE task_id=?", [task_id], (error, results, fields) => {
            if (error) throw error;
            else if (results) {
                res.redirect("/");
            }
            else {
                res.send("Cannot find task in database!!");
            }
        });
    }

});

// Refreshing the page after sign in
app.get("/auth/login", (req, res) => {
    if (req.session.loggedin) {
        res.redirect("/");
    }
    else {
        res.status(400).send("Unable to fetch resources");
    }
});

// Refreshing the page after signup
app.get("/auth/register", (req, res) => {
    if (req.session.loggedin) {
        res.redirect("/");
    }
    else {
        res.status(400).send("Unable to fetch resources");
    }
});

// Refreshing the page after logout
app.get("/logout", (req, res) => {
    if (!req.session.loggedin) {
        res.redirect("/");
    }
    else {
        res.status(400).send("Unable to fetch resources");
    }
})

// Refreshing page after new task creation
app.get("/new/task", (req, res) => {
    if (req.session.loggedin) {
        return res.redirect("/");
    } else {
        res.status(400).send("Unable to fetch resources");
    }
});

// Listening to Server
app.listen(PORT, () => {
    console.log(`Server is running successfully on ${PORT}`);
})



