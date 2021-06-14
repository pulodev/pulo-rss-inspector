require('dotenv').config()
const Parser = require('rss-parser');
const parser = new Parser();
const fetch = require('node-fetch');

const BASE_API_URL =  process.env.BASE_API_URL
const ADMIN_CUSTOM_KEY =  process.env.ADMIN_CUSTOM_KEY

async function inspectFeed() {
	try{
		const res = await fetch(`${BASE_API_URL}/active-contents`)
		const res_json = await res.json()
		const result = await updateRSS(res_json.items)
	 	return result	
	}catch(err) {
		throw err
	}
}

async function updateRSS(rss_lists) {
	 //loop rss list
    for (i = 0; i < rss_lists.length; i++) {
        let currentRSS = rss_lists[i]

        let feed = null
        try {
        	feed = await parser.parseURL(currentRSS.url);
        	console.log('Parsing RSS from : ' + currentRSS.title)
        }catch(err) {
        	console.log('Error parsing RSS: ' + currentRSS.url) 
        	console.log(err)
        	continue
        }

        let NEW_ITEMS = []    
        //New update   
            //if rss build date later than last checked 
            //some RSS have no lastbuildtime

        let latestBuilt = new Date(feed.lastBuildDate) || new Date(feed.updated)
            
        if(latestBuilt > new Date(currentRSS.last_checked_at)
        	|| feed.lastBuildDate == undefined) {
        	console.log(`New build from RSS ${currentRSS.title} since last time` )

            feed.items.forEach(item => {
                let published_at = item.pubDate || item.isoDate || item.pubDate || item.published
               
                //check item time
                if(new Date(published_at) > new Date(currentRSS.last_checked_at)) {
                    //prepare items to be inserted
                    NEW_ITEMS.push({
                        "title" : item.title || feed.title,
                        "url" : item.link || item.guid,
                        "body" : item.contentSnippet || item.description,
                        "owner" : item.creator || '',
                        "original_published_at" : published_at,
                        "tags" : (item.categories) ? item.categories.join() : '',
                        "media" : currentRSS.media,
                        "source_id" : currentRSS.id,
                        "contributor" : currentRSS.contributor,
                    })
                }
            });
        }

        //insert bulk to database and update time
        if(NEW_ITEMS.length != 0) {
        	//insert bulk items
        	fetch(`${BASE_API_URL}/store/content`, {
		        		method: 'POST',
		        		body: JSON.stringify({
		        			items: NEW_ITEMS,
		        			secret_code: ADMIN_CUSTOM_KEY
		        		}),
		        		headers: {
						   'Content-Type': 'application/json',
						 },
		        	})
				    .then(res => res.json())
				    .then(body => body)
					.catch(err => console.error(err));

			//update last_checked_at
			fetch(`${BASE_API_URL}/updatetime/source`, {
		        		method: 'POST',
		        		body: JSON.stringify({
		        			last_checked_at: new Date(),
		        			id: currentRSS.id,
		        			secret_code: ADMIN_CUSTOM_KEY
		        		}),
		        		headers: {
						   'Content-Type': 'application/json',
						 },
		        	})
				    .then(res => res.json())
				    .then(body => body)
					.catch(err => console.error(err));
        }
    }//end loop RSS

    return true
}


//auto run
inspectFeed()