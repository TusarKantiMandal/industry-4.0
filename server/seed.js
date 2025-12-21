const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

const serialize = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            resolve();
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

async function createSchema() {
    console.log("Creating schema...");
    await run("PRAGMA foreign_keys = ON;");

    await run(`
        CREATE TABLE IF NOT EXISTS plants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS cells (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          plant_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, plant_id),
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id TEXT NOT NULL UNIQUE,
          fullname TEXT NOT NULL,
          cell_id INTEGER,
          email TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          plant_id INTEGER,
          role TEXT DEFAULT 'user',
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE SET NULL,
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS machines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          unique_id TEXT NOT NULL UNIQUE,
          minimum_skill INTEGER DEFAULT 1,
          plant_id INTEGER NOT NULL,
          cell_id INTEGER NOT NULL,
          checksheets_count INTEGER DEFAULT 1,
          ip_address TEXT DEFAULT "192.168.10.2",
          port INTEGER DEFAULT 102,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
          FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE CASCADE,
          FOREIGN KEY (minimum_skill) REFERENCES skills(id)
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS user_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          machine_id INTEGER NOT NULL,
          skill_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
          UNIQUE(user_id, machine_id, skill_id)
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS ppt_machines(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          machine_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT,
          type TEXT,
          min_value REAL,
          max_value REAL,
          unit TEXT,
          alert_email TEXT,
          time TEXT,
          clit TEXT,
          how TEXT,
          photo_url TEXT,
          db_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS machine_checkpoint (
          checkpoint_id INTEGER NOT NULL,
          machine_id INTEGER NOT NULL,
          page INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          PRIMARY KEY (checkpoint_id, machine_id, page),
          UNIQUE(checkpoint_id, machine_id, page)
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS data(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			machine_id INTEGER NOT NULL,
			checkpoint_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			month INTEGER NOT NULL,
			year INTEGER NOT NULL,
			day INTEGER NOT NULL,
			value TEXT NOT NULL,
			shift TEXT NOT NULL,
			approved INTEGER DEFAULT 0,
			comment TEXT,
			approver_email TEXT,
			approver_name TEXT,
			batch_id INTEGER,
			page INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
			FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp TEXT NOT NULL,
            purpose TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS temp_access_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            creator_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS temp_access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          access_code_id INTEGER NOT NULL,
          real_user_id INTEGER NOT NULL,
          ip_address TEXT,
          login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (access_code_id) REFERENCES temp_access_codes(id) ON DELETE CASCADE,
          FOREIGN KEY (real_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    console.log("Schema created.");
}

async function seed() {
    try {
        await createSchema();
        console.log("Seeding database...");

        // Plants
        await run("INSERT OR IGNORE INTO plants (id, name) VALUES (1, 'Gear Plant')");
        await run("INSERT OR IGNORE INTO plants (id, name) VALUES (2, 'Axle Plant')");

        // SEED skills
        const skills = [
            { id: 1, name: 'L1' },
            { id: 2, name: 'L2' },
            { id: 3, name: 'L3' },
            { id: 4, name: 'L4' }
        ];

        for (const skill of skills) {
            await run("INSERT OR IGNORE INTO skills (id, name) VALUES (?, ?)", [skill.id, skill.name]);
        }

        const cells = [

            // Seed cells if required

            // {id: 1, name: "CELL_NAME", plant_id: 1},
            // {id: 2, name: "CELL_NAME", plant_id: 2},
        ]

        for (const cell of cells) {
            await run("INSERT OR IGNORE INTO cells (id, name, plant_id) VALUES (?, ?, ?)", [cell.id, cell.name, cell.plant_id]);
        }


        const machines = [
            // Add machines if needed

            // { id: 1, name: 'Lathe Machine', plant_id: 1, cell_id: 1, minimum_skill: 2}
            // minimum_skill is a foreign key to skills.id
        ];

        for (const machine of machines) {
            await run(
                "INSERT OR IGNORE INTO machines (id, name, plant_id, cell_id, minimum_skill) VALUES (?, ?, ?, ?, ?)",
                [machine.id, machine.name, machine.plant_id, machine.cell_id, machine.minimum_skill]
            );
        }


        // Users

        const users = [
            { id: 1, fullname: 'IT Admin', email: 'it@admin.me', username: 'itAdmin', password: '123456', role: 'itAdmin', employee_id: 'EMP1' },
            // Add more if needed
        ];

        for (const user of users) {
            await run(
                `INSERT OR IGNORE INTO users (id, fullname, email, username, password, role, employee_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [user.id, user.fullname, user.email, user.username, user.password, user.role, user.employee_id]
            );
        }
        console.log("Seeding completed successfully.");
    } catch (err) {
        console.error("Error seeding database:", err);
    } finally {
        db.close();
    }
}

seed();
