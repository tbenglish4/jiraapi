// Saves options to chrome.storage
function save_options() {
  var prj = document.getElementById('project').value;
  var usr = document.getElementById('user').value;
  var max = document.getElementById('maximumresults').value;
  chrome.storage.sync.set({
    project: prj,
    user: usr,
	maximumresults: max
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    status.hidden = false;
    setTimeout(function() {
      status.textContent = '';
      status.hidden = true;
    }, 1000);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden',
	maximumresults: 50
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
	document.getElementById('maximumresults').value = items.maximumresults;
  });

  document.getElementById('save').addEventListener('click', save_options);
}
document.addEventListener('DOMContentLoaded', restore_options);