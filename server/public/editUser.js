// DOM elements
const form = document.getElementById("edit-user-form");
const addSkillBtn = document.getElementById("add-skill-btn");
const skillsContainer = document.getElementById("skills-container");
const modal = document.getElementById("add-skill-modal");
const closeModalBtn = document.getElementById("close-modal");
const cancelAddSkillBtn = document.getElementById("cancel-add-skill");
const confirmAddSkillBtn = document.getElementById("confirm-add-skill");
const cancelBtn = document.getElementById("cancel-btn");
const resetPasswordBtn = document.getElementById("reset-password-btn");
const activeStatus = document.getElementById("active-status");
const notification = document.getElementById("notification");
const notificationMessage = document.getElementById("notification-message");
const usernameInput = document.getElementById("username");
const userAvatar = document.getElementById("user-avatar");
const skillSelect = document.getElementById("new-skill-name");

// Get user ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
console.log(urlParams);
const userId = urlParams.get("id") || "";

var globalUser = {};

// Load user data when page loads
document.addEventListener("DOMContentLoaded", () => {
  if (userId) {
    loadUserData(userId);
  } else {
    showNotification("No user ID provided", "error");
  }
});

// Function to load user data
function loadUserData(userId) {
  fetch(`/api/users/${userId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load user data");
      }
      return response.json();
    })
    .then((user) => {
      // Populate form fields
      document.getElementById("fullname").value = user.fullname || "";
      document.getElementById("username").value = user.username || "";
      document.getElementById("email").value = user.email || "";
      document.getElementById("cell").value = user.cell || "";
      document.getElementById("user-id").value = userId;
      document.getElementById("active-status").checked = user.active === 1;
      document.getElementById("role").value = user.role;

      // Update user avatar
      if (user.username) {
        userAvatar.textContent = user.username.charAt(0).toUpperCase();
      }

      // Set active status color
      if (user.active === 1) {
        userAvatar.style.backgroundColor = "var(--primary-light)";
        userAvatar.style.color = "var(--primary)";
      } else {
        userAvatar.style.backgroundColor = "#ffebe6";
        userAvatar.style.color = "var(--danger)";
      }

      // Set plant selection
      if (user.plant_id) {
        const plantSelect = document.getElementById("plant-id");
        for (let i = 0; i < plantSelect.options.length; i++) {
          if (plantSelect.options[i].value == user.plant_id) {
            plantSelect.selectedIndex = i;
            break;
          }
        }
      }

      // Clear existing skills
      skillsContainer.innerHTML = "";

      // Add user skills
      if (user.skills && user.skills.length > 0) {
        user.skills.forEach((skill, index) => {
          addSkillCard(skill.machine_name, skill.skill.toString(), index + 1);
        });
        skillCounter = user.skills.length + 1;
      } else {
        skillCounter = 1;
      }

      globalUser = user;

      populateMachines(user.plant_id);
    })
    .catch((error) => {
      showNotification(error.message, "error");
    });
}

// Update user avatar when username changes
usernameInput.addEventListener("input", () => {
  if (usernameInput.value) {
    userAvatar.textContent = usernameInput.value.charAt(0).toUpperCase();
  } else {
    userAvatar.textContent = "?";
  }
});

// Toggle active status display
activeStatus.addEventListener("change", () => {
  if (activeStatus.checked) {
    userAvatar.style.backgroundColor = "var(--primary-light)";
    userAvatar.style.color = "var(--primary)";
  } else {
    userAvatar.style.backgroundColor = "#ffebe6";
    userAvatar.style.color = "var(--danger)";
  }
});

// Handle form submission
form.addEventListener("submit", (e) => {
  e.preventDefault();

  // Collect form data
  const formData = {
    fullname: document.getElementById("fullname").value,
    email: document.getElementById("email").value,
    cell: document.getElementById("cell").value,
    skills: [],
  };

  var skillError = false;

  // Collect skills data
  const skillCards = skillsContainer.querySelectorAll(".skill-card");
  skillCards.forEach((card, index) => {
    const skillName = card.querySelector(".skill-title").textContent;
    const skillLevel = card.querySelector("input[type='radio']:checked").value;

    if (formData.skills.some((skill) => skill.name === skillName)) {
      showNotification(`Skill "${skillName}" already exists`, "error");
      skillError = true;
      return;
    }

    formData.skills.push({
      name: skillName,
      level: skillLevel,
    });
  });

  if (skillError) {
    return;
  }

  // Send data to server
  fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to update user");
      }
      return response.json();
    })
    .then((data) => {
      showNotification("User updated successfully", "success");
    })
    .catch((error) => {
      showNotification(error.message, "error");
    });
});

// Cancel button handler
cancelBtn.addEventListener("click", () => {
  window.location.href = "/admin";
});

// Reset password button handler
resetPasswordBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset this user's password?")) {
    fetch(`/api/users/${userId}/reset-password`, {
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to reset password");
        }
        return response.json();
      })
      .then((data) => {
        showNotification("Password reset email sent", "success");
      })
      .catch((error) => {
        showNotification(error.message, "error");
      });
  }
});

let skillCounter = 3;

addSkillBtn.addEventListener("click", () => {
  openModal();
});

function openModal() {
  modal.classList.add("active");
  document.getElementById("new-skill-name").focus();
}

function closeModal() {
  modal.classList.remove("active");
  document.getElementById("new-skill-name").value = "";
  document.getElementById("new-skill-level-1").checked = true;
}

closeModalBtn.addEventListener("click", closeModal);
cancelAddSkillBtn.addEventListener("click", closeModal);

confirmAddSkillBtn.addEventListener("click", () => {
  const skillName = document.getElementById("new-skill-name").value.trim();
  const skillLevel = document.querySelector(
    'input[name="new-skill-level"]:checked'
  ).value;

  if (!skillName) {
    alert("Please enter a skill name");
    return;
  }

  addSkillCard(skillName, skillLevel);
  closeModal();
});

function addSkillCard(name, level, customId = null) {
  const skillId = customId || skillCounter++;

  console.log(level);

  const skillCard = document.createElement("div");
  skillCard.className = "skill-card";
  skillCard.innerHTML = `
    <div class="skill-header">
      <h3 class="skill-title">${name}</h3>
      <button type="button" class="remove-skill">
        <i class="fas fa-trash"></i> Remove
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Skill Level</label>
      <div class="skill-level">
        <div class="level-option">
          <input type="radio" name="skill-${skillId}-level" id="skill-${skillId}-level-1" class="level-radio" value="L1" ${
    level === "L1" ? "checked" : ""
  }>
          <label for="skill-${skillId}-level-1" class="level-label">L1</label>
        </div>
        <div class="level-option">
          <input type="radio" name="skill-${skillId}-level" id="skill-${skillId}-level-2" class="level-radio" value="L2" ${
    level === "L2" ? "checked" : ""
  }>
          <label for="skill-${skillId}-level-2" class="level-label">L2</label>
        </div>
        <div class="level-option">
          <input type="radio" name="skill-${skillId}-level" id="skill-${skillId}-level-3" class="level-radio" value="L3" ${
    level === "L3" ? "checked" : ""
  }>
          <label for="skill-${skillId}-level-3" class="level-label">L3</label>
        </div>
      </div>
    </div>
    </div>
  `;

  skillsContainer.appendChild(skillCard);

  // Add event listener to remove button
  const removeBtn = skillCard.querySelector(".remove-skill");
  removeBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to remove this skill?")) {
      skillCard.remove();
    }
  });
}

// Display notification
function showNotification(message, type) {
  notification.className = `notification notification-${type}`;
  notificationMessage.textContent = message;
  notification.classList.remove("notification-hidden");

  // Auto hide after 3 seconds
  setTimeout(() => {
    notification.classList.add("notification-hidden");
  }, 3000);
}

// Add event listener to click outside dropdown menus to close them
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) {
    const dropdowns = document.querySelectorAll(".dropdown-menu");
    dropdowns.forEach((dropdown) => {
      dropdown.style.display = "none";
    });
  }
});

async function getMachines(plantId) {
  try {
    const response = await fetch(`/api/plants/${plantId}/machines`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching machines:", error);
    showNotification("Error fetching machines", "error");
  }
}

async function populateMachines(plantId) {
  skillSelect.innerHTML = '<option value="">-- Select a Skill --</option>';

  const machines = await getMachines(plantId);

  machines.forEach((machine) => {
    const option = document.createElement("option");
    option.value = machine.name;
    option.textContent = machine.name;
    skillSelect.appendChild(option);
  });

  if (machines.length === 0) {
    const noMachinesOption = document.createElement("option");
    noMachinesOption.value = "";
    noMachinesOption.textContent = "No machines available";
    skillSelect.appendChild(noMachinesOption);
  }
}

function onPlantChange(event) {
  const confirmed = confirm(
    "Are you sure you want to change the plant?\nAll the skills will be removed and this action cannot be undone."
  );

  if (!confirmed) {
    event.target.value = globalUser.plant_id;
    return;
  }

  const selectedPlant = event.target.value;
  fetch(`/api/users/${globalUser.id}/plant`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plantId: selectedPlant }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to update plant");
      }
      return response.json();
    })
    .then((data) => {
      console.log(data.message);
      showNotification("Plant updated successfully!", "success");
      globalUser.plant_id = selectedPlant;
    })
    .catch((error) => {
      console.error("Error:", error);
      showNotification("Error updating plant. Please try again.", "error");
      event.target.value = globalUser.plant_id;
    })
    .finally(() => {
      window.location.reload();
    });
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("plant-id").addEventListener("change", onPlantChange);
});

