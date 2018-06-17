/**
 * Request and download the JIRA feed for a particular user
 * @param {function(xmlDocument, string)} callback - Called to process and render the results of the XMLDocument returned
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
function getJIRAFeed(callback, errorCallback){
    var user = document.getElementById("user").value;
    if(!user) {
		displayErrorStatus("Please enter a user name to view feed activity");
	} else {
		var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+"+encodeURIComponent(user)+"&providers=issues";
		makeAndProcessRequest(url, callback, errorCallback, "xml");
	}
}

/**
 * Request and download results for a query on JIRA issues
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 */
function getJIRAQueryResult(callback) {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value
  if (!project) {
	  displayErrorStatus("You must enter a project name to query for");
  } else if (!inStatusFor) {
	  displayErrorStatus("You must choose a for longer than value in your query");
  } else {
	var fullCallbackUrl = callbackBase;
	fullCallbackUrl += `project=${encodeURIComponent(project)}+and+status=${encodeURIComponent(status)}+and+status+changed+to+${encodeURIComponent(status)}+before+-${encodeURIComponent(inStatusFor)}d&fields=id,status,key,assignee,summary&maxresults=100`;
	callback(fullCallbackUrl);
  }
}

/**
 * Make and process an HTTP GET request that returns a JSON response
 * @param {string} url
 * @param {function(responseObject, string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
async function makeAndProcessRequest(url, callback, errorCallback, responseFormat) {                                                 
    try {
      var response = await make_request(url, responseFormat);
      callback(response, url);
    } catch (error) {
      errorCallback(error);
    }
}

/**
 * Make an HTTP Get request
 * @param {string} url - The url to make the request to
 * @param {string} responseType - string that specifies what the format of the response should be, e.g. json
 * Returns a promise you can await on, containing a result or rejection error
 */
function make_request(url, responseType) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
	if (responseType == "xml") {
		req.responseType = "";
	} else {
		req.responseType = responseType;
	}

    req.onload = function() {
	  var response = null;
	  if (responseType == "xml") {
		  response = req.responseXML;
	  } else {
		  response = req.response;
	  }
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

// Load all default user options from chrome storage
function loadOptions(){
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}

// utility 
function domify(str){
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

// Returns a promise that contains a response from the project-specific url, which can be used to check whether the project exists
async function checkProjectExists(){
    try {
		var project = document.getElementById("project").value;
      return await make_request(`https://jira.secondlife.com/rest/api/2/project/${encodeURIComponent(project)}`, "json");
    } catch (errorMessage) {
      displayErrorStatus(errorMessage);
    }
}

/**
 * Render the results from a JIRA Issues query
 * @param {jsonObject} return_val - A json object returned with query results, see results.json for an example
 * @param {string} url - The url of the request that return_val came from
 */
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

/**
 * Render a JIRA feed
 * @param {xmlDocument} xmlDoc - An xml document that contains the results of the request
 * @param {string} url - The url of the request that xmlDoc came from
 */
function renderFeedResults(xmlDoc, url) {
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
		feedResultDiv.hidden = false;
	} else {
		document.getElementById('status').innerHTML = 'There are no activity results.';
		document.getElementById('status').hidden = false;
		feedResultDiv.hidden = true;
	}
}

/**
 * Add a li element to the provided list, with a specific innerHTML
 * @param {ul DOM element} list - The unordered list that will be added to
 * @param {string} itemInnerHTML - the Inner HTML to set in the new list item
 */
function addListItemToList(list, itemInnerHTML) {
	var issueInnerListKeyItem = document.createElement('li');
	issueInnerListKeyItem.innerHTML = itemInnerHTML;
	list.appendChild(issueInnerListKeyItem);
	return issueInnerListKeyItem;
}

/**
 * Build an <a> link element
 * @param {ul DOM element} list - The unordered list that will be added to
 * @param {string} itemInnerHTML - the Inner HTML to set in the new list item
 */
function buildLinkHTML(linkUrl, linkText) {
	var linkItem = document.createElement('a');
	linkItem.href = linkUrl;
	linkItem.innerHTML = linkText;
	return linkItem;
}
	
// Display an error status
function displayErrorStatus(errorText) {
	document.getElementById('status').innerHTML = `ERROR. ${errorText}`;
    document.getElementById('status').hidden = false;
	document.getElementById('query-result').hidden = true;
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
        getJIRAQueryResult(function(url) {
          document.getElementById('status').innerHTML = 'Performing JIRA search for ' + url;
          document.getElementById('status').hidden = false;  
          // perform the search
          makeAndProcessRequest(url, renderQueryResults, function(errorMessage) {
              displayErrorStatus(errorMessage);
          }, "json");
        });
      }

      // activity feed click handler
      document.getElementById("feed").onclick = function(){   
        // get the xml feed
        getJIRAFeed(renderFeedResults, function(errorMessage) {
          displayErrorStatus(errorMessage);
        });    
      };        

    }).catch(function(errorMessage) {
        displayErrorStatus(errorMessage);
    });   
});
