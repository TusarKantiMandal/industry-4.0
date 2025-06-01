function submitToApprover() {
    const approver = document.getElementById('approver').value;
    if (!approver) {
      alert("Please select an approver.");
      return;
    }
  
    const data = {
      machine: document.querySelector('input[value="GP200-1"]').value,
      cell: document.querySelector('input[value="E.V Gear"]').value,
      year: document.getElementById('year').value,
      month: document.getElementById('month').value,
      approver: approver,
      submittedBy: "John Doe", // Replace with real user info from session/login
      timestamp: new Date().toISOString()
    };
  
    fetch('/api/submit-checksheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => {
      if (res.ok) {
        alert(`Check Sheet submitted to ${approver} for approval.`);
        closeApprovalPopup();
      } else {
        alert("Submission failed.");
      }
    });
  }
  