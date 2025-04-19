INSERT INTO plants (name) VALUES ('Plant A');
INSERT INTO plants (name) VALUES ('Plant B');

INSERT INTO users (fullname, cell, email, username, password, plant_id, role)
VALUES 
  ('tusar', 'e.v', '20231113068@dypiu.ac.in', 'tusar12', '123456', 1, 'itAdmin');
  ('Alice Smith', '1234567890', 'alice@example.com', 'alice', 'password123', 1, 'admin'),
  ('Bob Johnson', '9876543210', 'bob@example.com', 'bob', 'password456', 1, 'user'),
  ('Charlie Brown', '1112223333', 'charlie@example.com', 'charlie', 'password789', 2, 'user');

INSERT INTO machines (name, plant_id) 
VALUES 
  ('Lathe Machine', 1),
  ('Drill Press', 1),
  ('Milling Machine', 2);

INSERT INTO user_skills (user_id, machine_id, skill)
VALUES 
  (1, 1, 'L1'),
  (1, 2, 'L2'),
  (2, 1, 'L1'),
  (3, 3, 'L3'),
  (2, 2, 'L3');
