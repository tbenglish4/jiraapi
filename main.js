const JIRA_SECONDLIFE_URL = "https://jira.secondlife.com";
const ELEMENT_PROJECT_ID = "project";
const ELEMENT_USER_ID = "user";
const ELEMENT_MAXIMUMRESULTS_ID = "maximumresults";
const ELEMENT_STATUSSELECT_ID = "statusSelect";
const ELEMENT_DAYSPAST_ID = "daysPast";
const ELEMENT_STATUS_ID = "status";
const ELEMENT_FEED_ID = "feed";
const XMLRESPONSE_FEED_TAG = "feed";
const XMLRESPONSE_ENTRY_TAG = "entry";
const XMLRESPONSE_TITLE_TAG = "title";
const XMLRESPONSE_UPDATED_TAG = "updated";
const ELEMENT_QUERY_ID = "query";
const ELEMENT_QUERYRESULT_ID = "query-result";
const RESPONSE_TYPE_XML = "xml";
const RESPONSE_TYPE_JSON = "json";

/**
 * Request and download the JIRA feed for a particular user
 * @param {async function(string, string)} makeRequestDelegate - The makeRequest function or a function with similar behavior
 * @param {function(xmlDocument, string)} callback - Called to process and render the results of the XMLDocument returned
 */
function getJIRAFeed(makeRequestDelegate, callback){
    var user = document.getElementById(ELEMENT_USER_ID).value;
	var maximumresults = document.getElementById(ELEMENT_MAXIMUMRESULTS_ID).value;
    if(!user) {
		displayErrorStatus("Please enter a user name to view feed activity");
	} else if (!maximumresults) {
		displayErrorStatus("Please specify a valid maximum number of items to return in your chrome options for this extension");
	} else {
		var url = JIRA_SECONDLIFE_URL+"/activity?maxResults="+encodeURIComponent(maximumresults)+"&streams=user+IS+"+encodeURIComponent(user)+"&providers=issues";
		makeAndProcessRequest(url, makeRequestDelegate, callback, displayErrorStatus, RESPONSE_TYPE_XML).then(function()  { return; });
	}
}

/**
 * Request and download results for a query on JIRA issues
 * @param {async function(string, string)} makeRequestDelegate - The makeRequest function or a function with similar behavior
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 */
function getJIRAQueryResult(makeRequestDelegate, callback) {
  var callbackBase = JIRA_SECONDLIFE_URL+"/rest/api/2/search?jql=";
  var project = document.getElementById(ELEMENT_PROJECT_ID).value;
  var status = document.getElementById(ELEMENT_STATUSSELECT_ID).value;
  var inStatusFor = document.getElementById(ELEMENT_DAYSPAST_ID).value;
  var maximumresults = document.getElementById(ELEMENT_MAXIMUMRESULTS_ID).value;
  if (!project) {
	  displayErrorStatus("You must enter a project name to query for");
  } else if (!inStatusFor) {
	  displayErrorStatus("You must choose a for longer than value in your query");
  } else if (!maximumresults) {
		displayErrorStatus("Please specify a valid maximum number of items to return in your chrome options for this extension");
  } else {
	var fullCallbackUrl = callbackBase;
	fullCallbackUrl += `project=${encodeURIComponent(project)}+and+status=${encodeURIComponent(status)}+and+status+changed+to+${encodeURIComponent(status)}+before+-${encodeURIComponent(inStatusFor)}d&fields=id,status,key,assignee,summary&maxresults=${encodeURIComponent(maximumresults)}`;
	document.getElementById(ELEMENT_STATUS_ID).innerHTML = 'Making request...';
    document.getElementById(ELEMENT_STATUS_ID).hidden = false;  
	makeAndProcessRequest(fullCallbackUrl, makeRequestDelegate, callback, displayErrorStatus, RESPONSE_TYPE_JSON).then(function()  { return; });
  }
}

/**
 * Make and process an HTTP GET request that returns a JSON response
 * @param {string} url
 * @param {async function(string, string)} makeRequestDelegate - The makeRequest function or a function with similar behavior
 * @param {function(responseObject, string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 * @param {string} responseFormat - string that specifies what the format of the response should be, e.g. json
 */
async function makeAndProcessRequest(url, makeRequestDelegate, callback, errorCallback, responseFormat) {                                                 
    try {
      var response = await makeRequestDelegate(url, responseFormat);
      callback(response, url);
    } catch (error) {
      errorCallback(error);
    }
}

/**
 * Make an HTTP Get request
 * @param {string} url - The url to make the request to
 * @param {string} responseFormat - string that specifies what the format of the response should be, e.g. json
 * Returns a promise you can await on, containing a result or rejection error
 */
function makeRequest(url, responseFormat) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
	if (responseFormat == RESPONSE_TYPE_XML) {
		req.responseType = "";
	} else {
		req.responseType = responseFormat;
	}

    req.onload = function() {
	  var response = null;
	  if (responseFormat == RESPONSE_TYPE_XML) {
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
    user: 'nyx.linden',
	maximumresults: 50
  }, function(items) {
    document.getElementById(ELEMENT_PROJECT_ID).value = items.project;
    document.getElementById(ELEMENT_USER_ID).value = items.user;
	document.getElementById(ELEMENT_MAXIMUMRESULTS_ID).value = items.maximumresults;
  });
}

/**
 * Get the text content for an arbitrary string that can contain HTML
 * @param {string} str - the input to Domify
 * Returns the text content of str
 */
function domify(str){
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

// Returns a promise that contains a response from the project-specific url, which can be used to check whether the project exists
async function checkProjectExists(){
    try {
		var project = document.getElementById(ELEMENT_PROJECT_ID).value;
      return await makeRequest(`https://jira.secondlife.com/rest/api/2/project/${encodeURIComponent(project)}`, RESPONSE_TYPE_JSON);
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
	document.getElementById(ELEMENT_STATUS_ID).hidden = true;
	
	var jsonResultDiv = document.getElementById(ELEMENT_QUERYRESULT_ID);
	if (return_val.total && return_val.total > 0) {
		if (return_val.total == return_val.issues.length) {
			var queryItemList = document.createElement('ul');
			for (var index = 0; index < return_val.issues.length; index++) {
				var issue = return_val.issues[index];
				var issueLink = buildLinkHTML(domify(issue["self"]), domify(issue.key)); 
				var issueHTMLItem = addListItemToList(queryItemList, `${issueLink.outerHTML}: ${domify(issue.fields.summary)}`);
				var issueInnerList = document.createElement('ul');
				addListItemToList(issueInnerList, `Status: ${domify(issue.fields.status.name)}. ${domify(issue.fields.status.description)}`);
				if (issue.fields.assignee) {
					var assigneeLink = buildLinkHTML(domify(issue.fields.assignee["self"]), domify(issue.fields.assignee.displayName));
					addListItemToList(issueInnerList, `Assigned To: ${assigneeLink.outerHTML} (${domify(issue.fields.assignee.emailAddress)})`);
				} else {
					addListItemToList(issueInnerList, `Assigned To: nobody`);
				}
				issueHTMLItem.appendChild(issueInnerList);
			}
			jsonResultDiv.innerHTML = queryItemList.outerHTML;
			jsonResultDiv.hidden = false;
		} else {
			document.getElementById(ELEMENT_STATUS_ID).innerHTML = 'Could not display activity results.';
			document.getElementById(ELEMENT_STATUS_ID).hidden = false;
			jsonResultDiv.hidden = true;
		}
	} else {
		document.getElementById(ELEMENT_STATUS_ID).innerHTML = 'There are no activity results.';
		document.getElementById(ELEMENT_STATUS_ID).hidden = false;
		jsonResultDiv.hidden = true;
	}
}

/**
 * Render a JIRA feed result
 * @param {xmlDocument} xmlDoc - An xml document that contains the results of the request
 * @param {string} url - The url of the request that xmlDoc came from
 */
function renderFeedResults(xmlDoc, url) {
	document.getElementById(ELEMENT_STATUS_ID).hidden = true;
	var feedResultDiv = document.getElementById(ELEMENT_QUERYRESULT_ID);
	
	var feed = xmlDoc.getElementsByTagName(XMLRESPONSE_FEED_TAG);
	if (!feed || feed.length == 0) {
		document.getElementById(ELEMENT_STATUS_ID).innerHTML = 'There are no feed results.';
		document.getElementById(ELEMENT_STATUS_ID).hidden = false;
		feedResultDiv.hidden = true;
		return;
	}
	var entries = feed[0].getElementsByTagName(XMLRESPONSE_ENTRY_TAG);
	if (!entries || entries.length == 0) {
		document.getElementById(ELEMENT_STATUS_ID).innerHTML = 'There are no feed results.';
		document.getElementById(ELEMENT_STATUS_ID).hidden = false;
		feedResultDiv.hidden = true;
		return;
	}
	var list = document.createElement('ul');

	for (var index = 0; index < entries.length; index++) {
		var htmlInfo = entries[index].getElementsByTagName(XMLRESPONSE_TITLE_TAG);
		var updatedInfo = entries[index].getElementsByTagName(XMLRESPONSE_UPDATED_TAG);
		if (htmlInfo && updatedInfo && htmlInfo.length > 0 && updatedInfo.length > 0) {
			var html = htmlInfo[0].innerHTML;
			var updated = updatedInfo[0].innerHTML;
			var item = document.createElement('li');
			item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
			list.appendChild(item);
		}
	}

	
	if(list.childNodes.length > 0){
		feedResultDiv.innerHTML = list.outerHTML;
		feedResultDiv.hidden = false;
	} else {
		document.getElementById(ELEMENT_STATUS_ID).innerHTML = 'There are no feed results.';
		document.getElementById(ELEMENT_STATUS_ID).hidden = false;
		feedResultDiv.hidden = true;
	}
}

/**
 * Helper method to add a li element to the provided list, with a specific innerHTML
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
 * Helper method to build an <a> link element
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
	document.getElementById(ELEMENT_STATUS_ID).innerHTML = `ERROR. ${errorText}`;
    document.getElementById(ELEMENT_STATUS_ID).hidden = false;
	document.getElementById(ELEMENT_QUERYRESULT_ID).hidden = true;
}

// Setup
document.addEventListener('DOMContentLoaded', function() {
  //load saved options
      loadOptions();
  // if logged in, setup listeners
    checkProjectExists().then(function() {
		
      // query click handler
      document.getElementById(ELEMENT_QUERY_ID).onclick = function(){
        // build query
        getJIRAQueryResult(makeRequest, renderQueryResults);
      }

      // activity feed click handler
      document.getElementById(ELEMENT_FEED_ID).onclick = function(){   
        // get the xml feed
        getJIRAFeed(makeRequest, renderFeedResults);    
      };        

    }).catch(function(errorMessage) {
        displayErrorStatus(errorMessage);
    });   
});
