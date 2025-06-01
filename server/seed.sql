INSERT INTO plants (name) VALUES ('Gear Plant');
INSERT INTO plants (name) VALUES ('Axle Plant');

INSERT INTO users (fullname, email, username, password, role, employee_id) VALUES  ('Test', 'it@test.me', 'itAdmin', '12345678', 'itAdmin', 'EMP1');
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
