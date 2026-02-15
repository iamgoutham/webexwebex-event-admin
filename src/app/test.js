function doGet(e) {
  // Check if the request contains the correct secret key
  const providedKey = e.parameter.key;
  
  if (providedKey !== EXTERNAL_API_KEY) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error", 
      "message": "Unauthorized: Invalid API Key"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  const email = e.parameter.email;

  try {
    const status = getWebexStatus(email);
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "isuser":(status)?"true":false,
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()}));
  }
}