const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin())
const fs = require("fs");
const { resolve } = require('path');

let scrape = async () => {

  // Function to scroll down the page automatically

  const autoScroll = async (page, totalHeight, distance) => {

    await page.evaluate(() => {
      window.removeElementsByClass = (className) => {
        let elements = document.getElementsByClassName(className);
        while(elements.length > 0){
          elements[0].parentNode.removeChild(elements[0])
        };
      }
    });

    return await page.evaluate(
      async ({totalHeight, distance}) => {
        console.log('Inside autoscroll');
        return await new Promise((resolve, reject) => 
          {
            let timer = setInterval(async() => {
              // Get the total height page, even those things that don't appears.
              let scrollHeight = document.body.scrollHeight;
              console.log(`ScrollHeight: ${scrollHeight}`);
              // Scroll down in y(pixel)
              window.scrollBy(0, distance);
              totalHeight = totalHeight + distance;
              console.log(`TotalHeight: ${totalHeight}`);
              // Remove ad divs
              console.log('Removing adds...');
              removeElementsByClass('Prebid-media-short')

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve(
                  {
                    'totalHeight':totalHeight, 
                  }
                )
              }   
              }, 400);
            }
        )
      }, {totalHeight, distance}
    )
      
  }

  // Iterate over elements and get car data

  const browser = await puppeteer.launch(({ args: ['--no-sandbox'], headless: false }));
  const page = await browser.newPage();

  // Set dimensions of the page
  await page.setViewport({ width: 1366, height: 768});

  console.log('Going to webmotors page');
  await page
    .goto(
      'https://www.webmotors.com.br/carros/estoque/jac?tipoveiculo=carros&marca1=JAC',
      { waitUntil: 'networkidle2' }
    );
  

  // See the logs on terminal
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  console.log('Waiting for car div selector');
  await page.waitFor(5000)

  try {
    console.log('Waiting for car div selector');

    await page.waitFor('div')
    
    let autoScrollNumber = 0
    let position = 0

    while(true){
      await page.waitFor(5000);
      console.log(`Initializing Autoscrolling ${autoScrollNumber}..`);
      let actualPosition = await autoScroll(page, position, 100);
      position = actualPosition.totalHeight;
      console.log(`Final of autoScroll ${autoScrollNumber}..`);

      await page.waitFor(5000);
      let totalPageHeight = await page.evaluate(()=> document.body.scrollHeight);
      console.log(`TotalPageHeight: ${totalPageHeight}`);
      // When the page scrolls down and doesn't find a button the page arrived in the final
      // then can be collect all cars data
      if (position>totalPageHeight && await page.$('#ButtonCarriesMoreCars') == null){
        console.log('Button not found..');
        break
      } 
      // When the page scrolls down and finds a button, then it is clicked to more content shows
      if (position>totalPageHeight && await page.$('#ButtonCarriesMoreCars') !== null){
        console.log('Button found..')
        console.log('Clicking on button..');
        await page.waitFor(5000);
        await page.$eval('#ButtonCarriesMoreCars', elem => elem.click());
      }
      autoScrollNumber++;
    };

    // Collect the numbers of divs with cars ads
    const divsCounts = await page
                                .$$eval(
                                  'div[class="sc-gxMtzJ dOzbaW"]', 
                                  divs => divs.length
                                );

    console.log(`Total car announced: ${divsCounts}`);
    
    // Collect data from all divs
    console.log('Collecting cars');
    await page.waitFor(5000)    
    const collectCars = await page.$$eval(
      'div[class="sc-gxMtzJ dOzbaW"]',
      divs => divs.map(div => div.textContent)
    ); 
    
    console.log(collectCars);

    return {collectCars: collectCars}

  } catch (error) {
    console.log(error);
  }
  browser.close();
};

// Save as json file
scrape().then((collectCars)=>{
  let json = JSON.stringify(collectCars)
  let fs = require('fs')
  fs.writeFile('myjsonfile.json', json, 'utf-8', ()=>{console.log('Finished');})
});



