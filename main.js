function getJIRAFeed(callback, errorCallback){
    var user = document.getElementById("user").value;
    if(user == undefined) return;
    
    var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+"+user+"&providers=issues";
    make_request(url, "").then(function(response) {
      // empty response type allows the request.responseXML property to be returned in the makeRequest call
      callback(url, response);
    }, errorCallback);
}
/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
async function getQueryResults(s, callback, errorCallback) {                                                 
    try {
      var response = await make_request(s, "json");
      callback(response, s);
    } catch (error) {
      errorCallback(error);
    }
}

function make_request(url, responseType) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function() {
      var response = responseType ? req.response : req.responseXML;
      if(response && response.errorMessages && response.errorMessages.length > 0){
        reject(response.errorMessages[0]);
        return;
      }
      resolve(response);
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    }
    req.onreadystatechange = function() { 
      if(req.readyState == 4 && req.status == 401) { 
          reject("You must be logged in to JIRA to see this project.");
      }
    }

    // Make the request
    req.send();
  });
}



function loadOptions(){
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}
function buildJQL(callback) {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value
  var fullCallbackUrl = callbackBase;
  fullCallbackUrl += `project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
  callback(fullCallbackUrl);
}

// utility 
function domify(str){
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

async function checkProjectExists(){
    try {
		var project = document.getElementById("project").value;
      return await make_request(`https://jira.secondlife.com/rest/api/2/project/${project}`, "json");
    } catch (errorMessage) {
      document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
      document.getElementById('status').hidden = false;
    }
}

function renderQueryResults(return_val, url) {
	// render the results
	document.getElementById('status').innerHTML = 'Query term: ' + url + '\n';
	document.getElementById('status').hidden = false;
	
	var jsonResultDiv = document.getElementById('query-result');
	if (return_val.total && return_val.total > 0) {
		if (return_val.total == return_val.issues.length) {
			var queryItemList = document.createElement('ul');
			for (var index = 0; index < return_val.issues.length; index++) {
				var issue = return_val.issues[index];
				var issueLink = buildLinkHTML(issue["self"], issue.key); 
				var issueHTMLItem = addListItemToList(queryItemList, `${issueLink.outerHTML}: ${issue.fields.summary}`);
				var issueInnerList = document.createElement('ul');
				addListItemToList(issueInnerList, `Status: ${issue.fields.status.name}. ${issue.fields.status.description}`);
				if (issue.fields.assignee) {
					var assigneeLink = buildLinkHTML(issue.fields.assignee["self"], issue.fields.assignee.displayName);
					addListItemToList(issueInnerList, `Assigned To: ${assigneeLink.outerHTML} (${issue.fields.assignee.emailAddress})`);
				} else {
					addListItemToList(issueInnerList, `Assigned To: nobody`);
				}
				issueHTMLItem.appendChild(issueInnerList);
			}
			jsonResultDiv.innerHTML = queryItemList.outerHTML;
			jsonResultDiv.hidden = false;
		} else {
			document.getElementById('status').innerHTML = 'Could not display activity results.';
			jsonResultDiv.hidden = true;
		}
	} else {
		document.getElementById('status').innerHTML = 'There are no activity results.';
		jsonResultDiv.hidden = true;
	}
}

function addListItemToList(list, itemInnerHTML) {
	var issueInnerListKeyItem = document.createElement('li');
	issueInnerListKeyItem.innerHTML = itemInnerHTML;
	list.appendChild(issueInnerListKeyItem);
	return issueInnerListKeyItem;
}

function buildLinkHTML(linkUrl, linkText) {
	var linkItem = document.createElement('a');
	linkItem.href = linkUrl;
	linkItem.innerHTML = linkText;
	return linkItem;
}
	

// Setup
document.addEventListener('DOMContentLoaded', function() {
  //load saved options
      loadOptions();
  // if logged in, setup listeners
    checkProjectExists().then(function() {
      // query click handler
      document.getElementById("query").onclick = function(){
        // build query
        buildJQL(function(url) {
          document.getElementById('status').innerHTML = 'Performing JIRA search for ' + url;
          document.getElementById('status').hidden = false;  
          // perform the search
          getQueryResults(url, renderQueryResults, function(errorMessage) {
              document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
              document.getElementById('status').hidden = false;
          });
        });
      }

      // activity feed click handler
      document.getElementById("feed").onclick = function(){   
        // get the xml feed
        getJIRAFeed(function(url, xmlDoc) {
          document.getElementById('status').innerHTML = 'Activity query: ' + url + '\n';
          document.getElementById('status').hidden = false;

          // render result
          var feed = xmlDoc.getElementsByTagName('feed');
          var entries = feed[0].getElementsByTagName("entry");
          var list = document.createElement('ul');

          for (var index = 0; index < entries.length; index++) {
            var html = entries[index].getElementsByTagName("title")[0].innerHTML;
            var updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
            var item = document.createElement('li');
            item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
            list.appendChild(item);
          }

          var feedResultDiv = document.getElementById('query-result');
          if(list.childNodes.length > 0){
            feedResultDiv.innerHTML = list.outerHTML;
          } else {
            document.getElementById('status').innerHTML = 'There are no activity results.';
            document.getElementById('status').hidden = false;
          }
          
          feedResultDiv.hidden = false;

        }, function(errorMessage) {
          document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
          document.getElementById('status').hidden = false;
        });    
      };        

    }).catch(function(errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
    });   
});
