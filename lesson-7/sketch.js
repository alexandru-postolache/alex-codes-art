let logo;
let settings = {
  numberOfItems: 10,
  colors: ['colors3', 'colors2', 'colors1'],
  padding: 2,
  cornerRadius: 50,
  minWidth: 180,
  minWidthMax: 400,
  maxWidth: 260,
  maxWidthMax: 600,
  randomSeed: 54,
}
colors = {
  colors1: ["#30bced","#303036","#fffaff","#fc5130","#050401"],  
  colors2: ["#ffac81","#ff928b","#fec3a6","#efe9ae","#cdeac0"],
  colors3: ["#031d44","#04395e","#70a288","#dab785","#d5896f"],  
};


// P5Capture.setDefaultOptions({
//   format: "png",
//   quality: 1,
//   width: 1080,
// });

function preload() {
  logo = loadImage('logo-horizontal.png');
}

function setup() {
  createCanvas(400, 600); // instagram reel is 1080x1920  
  pixelDensity(3);
  
  let gui = createGui("Settings");
  gui.setPosition(width + 10, 0);
  gui.addObject(settings);
  
  rectMode(CORNERS);
  noStroke();
}

function draw() {
  randomSeed(settings.randomSeed);
  background(240);
  
  // if (frameCount === 1) {
  //   const capture = P5Capture.getInstance();
  //   capture.start({
  //     duration: 350,
  //   });
  // }
  
  let itemWidth = random(settings.minWidth, settings.maxWidth);
  let itemHeight = (height - ((settings.numberOfItems - 1) * settings.padding)) / settings.numberOfItems;
  
  
  let leftAlign = (width / 2) - (itemWidth / 2);
  let rightAlign = (width / 2) + (itemWidth / 2);
  
  drawRectangles(itemWidth, itemHeight, leftAlign, rightAlign);
  
  drawLogo();
}

function drawRectangles(itemWidth, itemHeight, leftAlign, rightAlign) {
  for (i = 0; i < settings.numberOfItems; i++) {  
    push();
    translate(0, (itemHeight + settings.padding) * i);
    
    fill(colors[settings.colors][i % colors[settings.colors].length]);
    
    if (i % 2 == 0) {
      rect(leftAlign, 0, leftAlign + itemWidth, itemHeight, 0, settings.cornerRadius, 0, settings.cornerRadius);
      rightAlign = leftAlign + itemWidth;
    }else {
      rect(rightAlign - itemWidth, 0, rightAlign, itemHeight, settings.cornerRadius, 0, settings.cornerRadius, 0);
      leftAlign = rightAlign - itemWidth;
    }

    itemWidth = random(settings.minWidth, settings.maxWidth);
    pop();
  }
}

function drawLogo() {
  sizeDivision = 18;
  image(logo, (width / 2) - logo.width / (sizeDivision * 2), height - 50, logo.width / sizeDivision, logo.height / sizeDivision);
}
