const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

router.get("/", (req, res) => {
    const tab = req.query.tab || "users";
  
    if (tab === "users") {
      renderUsersPage(req, res);
    } else if (tab === "settings") {
    } else {
      res.status(400).send("Invalid tab");
    }
});

function renderUsersPage(req, res) {

    const pttUserId = req.user.id;
    
    const query = `
    SELECT DISTINCT 
      u.id, 
      u.fullname, 
      u.username, 
      u.email, 
      u.plant_id,
      u.active,
      u.role,
      p.name AS plant_name
    FROM users u
    LEFT JOIN plants p ON u.plant_id = p.id
    WHERE u.id != ?
      AND u.active = 1
    ORDER BY u.id ASC;
  `;
  

  db.all(query, [pttUserId], (err, users) => {
    if (err) {
      console.error("Error retrieving users:", err.message);
      return res.status(500).send("Database error occurred");
    }

    const html = generateAdminHTML(users);

    res.send(html);
  });
};

function generateAdminHTML(users) {
  const adminTemplatePath = path.join(__dirname, "public", "admin.html");
  let html = fs.readFileSync(adminTemplatePath, "utf8");

  const userRows = users
    .map((user) => {
      return `
      <tr>
        <td>${user.id}</td>
        <td>${user.fullname}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
        <td><span class="chip active-chip-${user.active}">${
        user.active === 1 ? "Active" : "Inactive"
      }</span></td>
        <td><span class="chip chip-${user.plant_id}">${
        user.plant_id
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
            const status = row.cells[5].textContent;

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
      const statusCell = row.cells[5].querySelector('.chip');
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





module.exports = router