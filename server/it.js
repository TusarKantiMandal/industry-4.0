const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

router.get("/users/edit", (req, res) => {
  const userId = req.query.id;
  res.sendFile(path.join(__dirname, "public", "editUser.html"));
});

router.get("/", (req, res) => {
  const tab = req.query.tab || "users";

  if (tab === "users") {
    renderUsersPage(res);
  } else if (tab === "settings") {
    renderSettingsPage(res);
  } else {
    res.status(400).send("Invalid tab");
  }
});

function renderUsersPage(res) {
  const query = `
    SELECT 
      u.id, 
      u.employee_id,
      u.fullname, 
      u.username, 
      u.email, 
      u.plant_id,
      u.active,
      u.role,
      p.name as plant_name
    FROM users u
    LEFT JOIN plants p ON u.plant_id = p.id
    WHERE u.role != 'itAdmin'
    ORDER BY u.id ASC
  `;

  db.all(query, [], (err, users) => {
    if (err) {
      console.error("Error retrieving users:", err.message);
      return res.status(500).send("Database error occurred");
    }

    const html = generateAdminHTML(users);

    res.send(html);
  });
}

function generateAdminHTML(users) {
  const adminTemplatePath = path.join(__dirname, "public", "admin.html");
  let html = fs.readFileSync(adminTemplatePath, "utf8");

  const userRows = users
    .map((user) => {
      return `
      <tr>
        <td>${user.id}</td>
        <td>${user.employee_id}</td>
        <td>${user.fullname}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
        <td><span class="chip active-chip-${user.active}">${user.active === 1 ? "Active" : "Inactive"
        }</span></td>
        <td><span class="chip chip-${user.plant_id}">${user.plant_id
        }</span></td>
        <td class="actions-cell">
          <div class="dropdown">
            <button class="dropdown-toggle">
              Actions <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  html = html.replace(
    /<tbody>[\s\S]*?<\/tbody>/g,
    `<tbody>${userRows}</tbody>`
  );

  html = html.replace(
    /Showing \d+ of \d+ users/g,
    `Showing ${users.length} of ${users.length} users`
  );

  html = html.replace("</head>", additionalStyles + "</head>");

  html = html.replace("</body>", enhancedScript + "</body>");

  return html;
}

const enhancedScript = `
<script>
  // Initialize dropdown actions
  document.querySelectorAll('.dropdown-toggle').forEach(button => {
      button.addEventListener('click', function() {
          // Create dropdown menu if it doesn't exist
          let menu = this.nextElementSibling;
           const row = this.closest('tr');
            const userId = row.cells[0].textContent;
            const status = row.cells[6].textContent.trim();

            const secondOption = status === 'Active' ? 'Deactivate' : 'Activate'

          if (!menu || !menu.classList.contains('dropdown-menu')) {
              menu = document.createElement('div');
              menu.className = 'dropdown-menu';
              menu.innerHTML = \`
                  <a href="#" class="dropdown-item edit-user">Edit</a>
                  <a href="#" class="dropdown-item delete-user">\${secondOption}</a>
              \`;
              this.parentNode.appendChild(menu);
              
              // Add event listeners to the newly created menu items

              menu.querySelector('.edit-user').addEventListener('click', function(e) {
                  e.preventDefault();
                  openEditUserPage(userId);
              });
              
              // Deactivate button click handler
              menu.querySelector('.delete-user').addEventListener('click', function(e) {
                  e.preventDefault();
                  confirmDeactivateUser(userId, row, secondOption);
              });
          }
          
          // Toggle menu visibility
          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
          
          // Close other menus
          document.querySelectorAll('.dropdown-menu').forEach(otherMenu => {
              if (otherMenu !== menu) {
                  otherMenu.style.display = 'none';
              }
          });
          
          // Stop propagation
          event.stopPropagation();
      });
  });
  
  // Function to open edit user page
  function openEditUserPage(userId) {
      // Navigate to edit page with user ID
      window.location.href = \`/admin/it/users/edit?id=\${userId}\`;
  }
  
  // Function to confirm and handle user deactivation
  function confirmDeactivateUser(userId, row, secondOption) {
        secondOption = secondOption.toLowerCase();
      // Create modal for confirmation
      const title = secondOption == 'activate' ? 'Confirm Activation' : 'Confirm Deactivation';
      const modal = document.createElement('div');
      modal.className = 'confirm-modal';
      modal.innerHTML = \`
          <div class="modal-content">
              <h3>\${title}</h3>
              <p>Are you sure you want to \${secondOption.toLowerCase()} user #\${userId}?</p>
              <div class="modal-actions">
                  <button class="btn btn-outline modal-cancel">Cancel</button>
                  <button class="btn btn-primary modal-confirm">Confirm</button>
              </div>
          </div>
      \`;
      document.body.appendChild(modal);
      
      // Add event listeners to modal buttons
      modal.querySelector('.modal-cancel').addEventListener('click', function() {
          document.body.removeChild(modal);
      });
      
      modal.querySelector('.modal-confirm').addEventListener('click', function() {
          // Call API to deactivate user
          deactivateUser(userId, row);
          document.body.removeChild(modal);
      });
      
      // Close modal when clicking outside
      modal.addEventListener('click', function(e) {
          if (e.target === modal) {
              document.body.removeChild(modal);
          }
      });
  }
  
  // Function to call API and deactivate user
  function deactivateUser(userId, row, action) {
      // Show loading state
      const statusCell = row.cells[6].querySelector('.chip');
      const originalText = statusCell.textContent;
      statusCell.textContent = 'Processing...';
      
      // Make API call
      fetch(\`/api/users/\${userId}/status\`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json'
          }
      })
      .then(response => {
          if (!response.ok) {
              throw new Error('Failed to action user');
          }
          return response.json();
      })
      .then(data => {
          // Update UI to reflect the change
        //   statusCell.className = action == 'activate' ? 'chip active-chip-1' :  'chip active-chip-0';
        //   statusCell.textContent = action == 'activate' ? 'Active' : 'Inactive';
          const msg = data.message;
          
          // Show success notification
          showNotification(msg , 'success');
          location.reload();
      })
      .catch(error => {
          // Restore original status on error
          statusCell.textContent = originalText;
          
          // Show error notification
          showNotification('Failed to action user: ' + error.message, 'error');
      });
  }
  
  // Function to display notifications
  function showNotification(message, type) {
      const notification = document.createElement('div');
      notification.className = \`notification notification-\${type}\`;
      notification.textContent = message;
      
      // Add to DOM
      document.body.appendChild(notification);
      
      // Remove after timeout
      setTimeout(() => {
          notification.classList.add('notification-hide');
          setTimeout(() => {
              document.body.removeChild(notification);
          }, 300);
      }, 3000);
  }
  
  // Close dropdown when clicking elsewhere
  document.addEventListener('click', function() {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.style.display = 'none';
      });
  });

  // Sort functionality
  document.querySelectorAll('th button').forEach(button => {
      button.addEventListener('click', function() {
          const index = this.closest('th').cellIndex;
          const isAscending = this.getAttribute('data-order') !== 'asc';
          
          // Reset all other sort indicators
          document.querySelectorAll('th button').forEach(btn => {
              btn.removeAttribute('data-order');
              btn.querySelector('.sort-icon').className = 'fas fa-sort sort-icon';
          });
          
          // Set this column's sort order
          this.setAttribute('data-order', isAscending ? 'asc' : 'desc');
          this.querySelector('.sort-icon').className = 'fas fa-sort-' + (isAscending ? 'up' : 'down') + ' sort-icon';
          
          // Sort table
          const tbody = document.querySelector('tbody');
          const rows = Array.from(tbody.querySelectorAll('tr'));
          
          rows.sort((a, b) => {
              const aValue = a.cells[index].textContent.trim();
              const bValue = b.cells[index].textContent.trim();
              
              // Handle numeric sorting
              if (!isNaN(aValue) && !isNaN(bValue)) {
                  return isAscending ? aValue - bValue : bValue - aValue;
              }
              
              // String sorting
              return isAscending 
                  ? aValue.localeCompare(bValue) 
                  : bValue.localeCompare(aValue);
          });
          
          // Reorder rows
          rows.forEach(row => tbody.appendChild(row));
      });
  });
  
  // Search functionality
  document.querySelector('.search-input').addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const rows = document.querySelectorAll('tbody tr');
      
      let visibleCount = 0;
      rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          const isVisible = text.includes(searchTerm);
          row.style.display = isVisible ? '' : 'none';
          if (isVisible) visibleCount++;
      });
      
      // Update counter
      document.querySelector('.table-footer div:first-child').textContent = 
          \`Showing \${visibleCount} of \${rows.length} users\`;
  });
</script>
`;

const additionalStyles = `
    <style>
      .dropdown-menu {
        position: absolute;
        right: 0;
        top: 100%;
        background-color: white;
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        min-width: 150px;
        z-index: 10;
        display: none;
      }
      
      .dropdown-item {
        display: block;
        padding: 0.75rem 1rem;
        text-decoration: none;
        color: var(--text-primary);
        transition: all 0.2s ease;
      }
      
      .dropdown-item:hover {
        background-color: var(--hover-bg);
      }
      
      .dropdown {
        position: relative;
      }
      
      .fa-sort-up, .fa-sort-down {
        color: var(--primary-color);
      }
      
      /* Modal styles */
      .confirm-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }
      
      .modal-content {
        background-color: white;
        border-radius: 0.5rem;
        padding: 1.5rem;
        width: 100%;
        max-width: 450px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .modal-content h3 {
        margin-bottom: 1rem;
        font-size: 1.25rem;
        font-weight: 600;
      }
      
      .modal-content p {
        margin-bottom: 1.5rem;
        color: var(--text-secondary);
      }
      
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      
      /* Notification styles */
      .notification {
        position: fixed;
        top: 1rem;
        right: 1rem;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 50;
        animation: slide-in 0.3s ease forwards;
        max-width: 350px;
      }
      
      .notification-success {
        background-color: #dcfce7;
        color: #166534;
        border-left: 4px solid #16a34a;
      }
      
      .notification-error {
        background-color: #fee2e2;
        color: #991b1b;
        border-left: 4px solid #dc2626;
      }
      
      .notification-hide {
        animation: slide-out 0.3s ease forwards;
      }
      
      @keyframes slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    </style>
`;

function renderSettingsPage(res) {
  // Get plants data
  const plantsQuery = `SELECT id, name FROM plants ORDER BY name ASC`;
  const skillsQuery = `SELECT id, name FROM skills ORDER BY name ASC`;
  const checkpointsQuery = `SELECT id, name, category, type, min_value, max_value, unit, alert_email, time, clit, how, photo_url, db_address FROM checkpoints ORDER BY name ASC`;

  db.all(plantsQuery, [], (err, plants) => {
    if (err) {
      console.error("Error retrieving plants:", err.message);
      return res.status(500).send("Database error occurred");
    }

    // Get machines data (no GROUP_CONCAT)
    const machinesQuery = `
      SELECT 
        m.id, 
        m.name, 
        s.name as minimum_skill,
        m.minimum_skill as minimum_skill_id,
        m.plant_id,
        m.cell_id,
        m.checksheets_count,
        c.name as cell_name,
        p.name as plant_name
      FROM machines m
      JOIN plants p ON m.plant_id = p.id
      JOIN skills s ON m.minimum_skill = s.id
      JOIN cells c ON m.cell_id = c.id
      ORDER BY m.name ASC
    `;

    db.all(machinesQuery, [], (err, machinesRaw) => {
      if (err) {
        console.error("Error retrieving machines:", err.message);
        return res.status(500).send("Database error occurred");
      }

      // For each machine, get its checkpoints as arrays
      const machineIds = machinesRaw.map(m => m.id);
      if (machineIds.length === 0) {
        // No machines found, render settings page with empty machines data
        // Get all cells
        const cellsQuery = `
        SELECT 
          c.id,
          c.name,
          c.plant_id,
          p.name as plant_name
        FROM cells c
        JOIN plants p ON c.plant_id = p.id
        ORDER BY c.name ASC`;

        db.all(cellsQuery, [], (err, cells) => {
          if (err) {
            console.error("Error retrieving cells:", err.message);
            return res.status(500).send("Database error occurred");
          }
          db.all(skillsQuery, [], (err, skills) => {
            if (err) {
              console.error("Error retrieving skills:", err.message);
              return res.status(500).send("Database error occurred");
            }
            db.all(checkpointsQuery, [], (err, checkpoints) => {
              if (err) {
                console.error("Error retrieving checkpoints:", err.message);
                return res.status(500).send("Database error occurred");
              }
              const html = generateSettingsHTML(
                plants,
                [],
                cells,
                skills,
                checkpoints
              );
              res.send(html);
            });
          });
        });
        return;
      }
      const placeholders = machineIds.map(() => '?').join(',');
      const checkpointsByMachineQuery = `
        SELECT mc.machine_id, ch.id as checkpoint_id, ch.name as checkpoint_name
        FROM machine_checkpoint mc
        JOIN checkpoints ch ON mc.checkpoint_id = ch.id
        WHERE mc.machine_id IN (${placeholders})
        ORDER BY mc.machine_id, ch.id
      `;
      db.all(checkpointsByMachineQuery, machineIds, (err, checkpointRows) => {
        if (err) {
          console.error("Error retrieving machine checkpoints:", err.message);
          return res.status(500).send("Database error occurred");
        }
        // Map machine_id to arrays
        const checkpointMap = {};
        checkpointRows.forEach(row => {
          if (!checkpointMap[row.machine_id]) {
            checkpointMap[row.machine_id] = { ids: [], names: [] };
          }
          checkpointMap[row.machine_id].ids.push(row.checkpoint_id);
          checkpointMap[row.machine_id].names.push(row.checkpoint_name);
        });
        // Attach arrays to each machine
        const machines = machinesRaw.map(m => ({
          ...m,
          checkpoint_ids: checkpointMap[m.id] ? checkpointMap[m.id].ids : [],
          checkpoint_names: checkpointMap[m.id] ? checkpointMap[m.id].names : [],
        }));
        // Get all cells
        const cellsQuery = `
        SELECT 
          c.id,
          c.name,
          c.plant_id,
          p.name as plant_name
        FROM cells c
        JOIN plants p ON c.plant_id = p.id
        ORDER BY c.name ASC`;

        db.all(cellsQuery, [], (err, cells) => {
          if (err) {
            console.error("Error retrieving cells:", err.message);
            return res.status(500).send("Database error occurred");
          }
          db.all(skillsQuery, [], (err, skills) => {
            if (err) {
              console.error("Error retrieving skills:", err.message);
              return res.status(500).send("Database error occurred");
            }
            db.all(checkpointsQuery, [], (err, checkpoints) => {
              if (err) {
                console.error("Error retrieving checkpoints:", err.message);
                return res.status(500).send("Database error occurred");
              }
              const html = generateSettingsHTML(
                plants,
                machines,
                cells,
                skills,
                checkpoints
              );
              res.send(html);
            });
          });
        });
      });
    });
  });
}

// Function to generate settings HTML
function generateSettingsHTML(plants, machines, cells, skills, checkpoints) {
  const settingsTemplatePath = path.join(__dirname, "public", "settings.html");
  let html = fs.readFileSync(settingsTemplatePath, "utf8");

  // Generate plants table rows
  const plantRows = plants
    .map((plant) => {
      return `
      <tr data-id="${plant.id}">
        <td>${plant.id}</td>
        <td>${plant.name}</td>
        <td class="actions-cell">
          <div class="dropdown">
            <button class="dropdown-toggle">
              Actions <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Generate machines table rows
  const machineRows = machines
    .map((machine) => {
      return `
      <tr data-id="${machine.id}">
        <td>${machine.id}</td>
        <td>${machine.name}</td>
        <td><span class="minSkill minSkill-${machine.minimum_skill_id}">${machine.minimum_skill}</span></td>
        <td><span class="chip chip-${machine.plant_id}">${machine.plant_name}</span></td>
        <td><span class="chip chip-${machine.cell_id}">${machine.cell_name}</span></td>
        <td>${machine.checksheets_count || 1}</td>
        <td style="display:none;"><span class="checkpoint" value="${machine.checkpoint_ids.join("///")}"> ${machine.checkpoint_names.join("///")}</span></td>
        <td class="actions-cell">
          <div class="dropdown">
            <button class="dropdown-toggle">
              Actions <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Generate cells table rows
  const cellRows = cells
    .map((cell) => {
      return `
      <tr data-id="${cell.id}">
        <td>${cell.id}</td>
        <td>${cell.name}</td>
        <td><span class="chip chip-${cell.plant_id}">${cell.plant_name}</span></td>
        <td class="actions-cell">
          <div class="dropdown">
            <button class="dropdown-toggle">
              Actions <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Generate checkpoints table rows
  const checkpointRows = checkpoints
    .map((checkpoint) => {
      return `
      <tr data-id="${checkpoint.id}" data-photo="${checkpoint.photo_url || ''}" data-db-address="${checkpoint.db_address || ''}">
        <td>${checkpoint.id}</td>
        <td>${checkpoint.name}</td>
        <td>${checkpoint.category || ''}</td>
        <td>${checkpoint.type || ''}</td>
        <td>${checkpoint.time || ''}</td>
        <td>${checkpoint.clit || ''}</td>
        <td>${checkpoint.how || ''}</td>
        <td>${checkpoint.min_value || ''}</td>
        <td>${checkpoint.max_value || ''}</td>
        <td>${checkpoint.unit || ''}</td>
        <td>${checkpoint.alert_email || ''}</td>
        <td class="actions-cell">
          <div class="dropdown">
            <button class="dropdown-toggle">
              Actions <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Replace placeholders in the template
  html = html.replace("<!-- PLANTS_TABLE_ROWS -->", plantRows);
  html = html.replace("<!-- MACHINES_TABLE_ROWS -->", machineRows);
  html = html.replace("<!-- CELLS_TABLE_ROWS -->", cellRows);
  html = html.replace("<!-- CHECKPOINTS_TABLE_ROWS -->", checkpointRows);

  // Generate plant options for dropdown
  const plantOptions = plants
    .map((plant) => {
      return `<option value="${plant.id}">${plant.name}</option>`;
    })
    .join("");

  // Generate skills options for dropdown
  const skillOptions = skills
    .map((skill) => {
      return `<option value="${skill.id}">${skill.name}</option>`;
    })
    .join("");

  // Generate cells options for dropdown
  const cellOptions = cells
    .map((cell) => {
      return `<option value="${cell.id}">${cell.name}</option>`;
    })
    .join("");

  html = html.replace("<!-- PLANT_OPTIONS -->", plantOptions);
  html = html.replace("<!-- PLANT_OPTIONS_CELLS -->", plantOptions);
  html = html.replace("<!-- SKILL_OPTIONS -->", skillOptions);
  html = html.replace("<!-- CELL_OPTIONS -->", cellOptions);

  return html;
}

// API endpoint to get checkpoints for the multiselect
router.get("/checkpoints", (req, res) => {
  const query = `SELECT id, name, category FROM checkpoints ORDER BY name ASC`;

  db.all(query, [], (err, checkpoints) => {
    if (err) {
      console.error("Error retrieving checkpoints:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    res.json(checkpoints);
  });
});

// API endpoint to get machine details with checkpoints by checksheet
router.get("/machines/:id", (req, res) => {
  const machineId = req.params.id;

  // Get machine basic info
  const machineQuery = `
    SELECT m.*, p.name as plant_name, c.name as cell_name, s.name as skill_name
    FROM machines m
    JOIN plants p ON m.plant_id = p.id
    JOIN cells c ON m.cell_id = c.id
    JOIN skills s ON m.minimum_skill = s.id
    WHERE m.id = ?
  `;

  db.get(machineQuery, [machineId], (err, machine) => {
    if (err) {
      console.error("Error retrieving machine:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    // Get machine checkpoints organized by checksheet (page)
    const checkpointsQuery = `
      SELECT mc.page, mc.checkpoint_id, cp.name, cp.category
      FROM machine_checkpoint mc
      JOIN checkpoints cp ON mc.checkpoint_id = cp.id
      WHERE mc.machine_id = ?
      ORDER BY mc.page, cp.name
    `;

    db.all(checkpointsQuery, [machineId], (err, checkpoints) => {
      if (err) {
        console.error("Error retrieving machine checkpoints:", err.message);
        return res.status(500).json({ error: "Database error occurred" });
      }

      // Organize checkpoints by checksheet
      const checkpointsByChecksheet = {};
      checkpoints.forEach(cp => {
        if (!checkpointsByChecksheet[cp.page]) {
          checkpointsByChecksheet[cp.page] = [];
        }
        checkpointsByChecksheet[cp.page].push({
          id: cp.checkpoint_id,
          name: cp.name,
          category: cp.category
        });
      });

      res.json({
        machine,
        checkpointsByChecksheet
      });
    });
  });
});


// Summary Page Route
router.get("/summary", (req, res) => {
  const summaryPath = path.join(__dirname, "public", "summary.html");
  res.sendFile(summaryPath);
});

module.exports = router;
