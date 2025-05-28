function fetchAndWriteNewsData() {
  // Configurable constants
  const NEWS_SOURCES = {
      "https://ndtv.in/"
  };

  const SHEET_HEADER = ['Language', 'Source Site', 'Name', 'Title', 'Keywords', 'Language (Tag)', 'Time of Publication', 'URL'];
  const SITEMAP_KEYWORDS = ['google-news', 'all-news', 'news', 'news-sitemap', 'newssitemap'];

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange("A1:H1").setValues([SHEET_HEADER]);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange("A2:H" + lastRow).clearContent();

  const rows = [];

  for (let language in NEWS_SOURCES) {
    Logger.log(`Starting language: ${language}`);
    for (let site of NEWS_SOURCES[language]) {
      Logger.log(`Checking site: ${site}`);
      try {
        const baseUrl = site.replace(/\/$/, "");
        const robotsUrl = baseUrl + "/robots.txt";
        let robotsResponse;

        try {
          robotsResponse = UrlFetchApp.fetch(robotsUrl, { muteHttpExceptions: true });
        } catch (err) {
          Logger.log(`Failed to fetch robots.txt from ${robotsUrl}: ${err.message}`);
          continue;
        }

        const sitemapLines = robotsResponse.getContentText().split('\n');
        let sitemapUrl = null;

        for (let keyword of SITEMAP_KEYWORDS) {
          const line = sitemapLines.find(l => l.toLowerCase().startsWith("sitemap:") && l.toLowerCase().includes(keyword));
          if (line) {
            sitemapUrl = line.split(/sitemap:/i)[1].trim();
            break;
          }
        }

        if (!sitemapUrl) {
          Logger.log(` No news sitemap found for ${site}`);
          continue;
        }

        let sitemapXml;
        try {
          sitemapXml = UrlFetchApp.fetch(sitemapUrl).getContentText();
        } catch (err) {
          Logger.log(`Error fetching sitemap URL: ${sitemapUrl}: ${err.message}`);
          continue;
        }

        let document, root;
        try {
          document = XmlService.parse(sitemapXml);
          root = document.getRootElement();
        } catch (err) {
          Logger.log(`XML parse error for ${sitemapUrl}: ${err.message}`);
          continue;
        }

        const namespaceNews = XmlService.getNamespace("http://www.google.com/schemas/sitemap-news/0.9");
        const urls = root.getChildren("url", root.getNamespace());

        if (!urls || urls.length === 0) {
          Logger.log(`No URLs found in sitemap for ${site}`);
          continue;
        }

        Logger.log(`Found ${urls.length} URLs in sitemap.`);

        urls.forEach((urlElement, i) => {
          try {
            const loc = urlElement.getChildText("loc", root.getNamespace()) || "";
            const news = urlElement.getChild("news", namespaceNews);
            if (!news) return;

            const pub = news.getChild("publication", namespaceNews);
            const name = pub?.getChildText("name", namespaceNews) || '';
            const langTag = pub?.getChildText("language", namespaceNews) || '';
            const title = news.getChildText("title", namespaceNews) || '';
            const pubDate = news.getChildText("publication_date", namespaceNews) || '';
            const keywords = news.getChildText("keywords", namespaceNews) || '';

            rows.push([language, baseUrl, name, title, keywords, langTag, pubDate, loc]);
          } catch (err) {
            Logger.log(`Error parsing URL element at index ${i} for ${site}: ${err.message}`);
          }
        });

      } catch (err) {
        Logger.log(`Unexpected error with ${site}: ${err.message}`);
      }
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, SHEET_HEADER.length).setValues(rows);
    Logger.log(`Written ${rows.length} rows to sheet.`);
  } else {
    Logger.log("No data written to sheet.");
  }

  Logger.log("Script completed.");
}
