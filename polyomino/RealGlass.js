/*
  RealGlass
  https://github.com/explosion-scratch/realglass
  Package license: ISC.

  Loaded as a classic script. It uses the p5 already on the page.
  Plate mode takes a canvas instead of an html2canvas screenshot of
  the document, and a later apply() can refresh that plate without
  building a new WebGL context.
*/

class RealGlass {
  constructor(sourceInstance = null) {
    this.sourceInstance = sourceInstance;
    this.capturedImage = null;
    this.lowResImage = null;
    this.maskTexture = null;
    this.blurredMaskTexture = null;
    this.shaderProgram = null;
    this.p5Instance = null;
    this.p5ImageLoader = null;
    this.resizeDebounceTimer = null;
    this.isInitialized = false;
    this.plateMode = false;
    this.view = null;
    this._appliedWidth = 0;
    this._appliedHeight = 0;
    this.targetElement = null;
    this.canvasContainer = null;
    this.currentParameters = {};
    this.onclone = () => {};
    this.scrollX = 0;
    this.scrollY = 0;
    this.documentHeight = 0;
    this.documentWidth = 0;
    this.vertexShaderSource = `
precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vTexCoord;

void main() {
    vTexCoord = aTexCoord;
    
    vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * viewModelPosition;
}`;

    this.fragmentShaderSource = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform sampler2D uLowResTexture;
uniform sampler2D uMaskTexture;
uniform sampler2D uBlurredMaskTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uOffset;
uniform vec2 uScale;
uniform float uChromaticAberration;
uniform sampler2D uFrostedTexture;
uniform float uGlassOpacity;
uniform float uLightStrength;
uniform vec2 uLightPosition;
uniform float uEdgeSmoothness;
uniform float uIOR;
uniform float uBorderRadius;
uniform float uSpecularShininess;
uniform vec2 uCardSize;
uniform float uThickness;
uniform vec3 uTintColor;
uniform float uTintStrength;
uniform float uRotationX;
uniform float uRotationY;
uniform float uRotationZ;
uniform float uScaleTransform;
uniform bool uUseMask;
uniform float uMaskSmoothingInset;

const float AIR_IOR = 1.0;
const float GLASS_THICKNESS_MAX = 0.7;
const float GLASS_THICKNESS_MIN = 0.1;

// Physical wavelengths for chromatic aberration (in micrometers)
const float LAMBDA_RED = 0.650;
const float LAMBDA_GREEN = 0.550;
const float LAMBDA_BLUE = 0.450;
const float LAMBDA_VIOLET = 0.400;

// Crown glass dispersion coefficients (more accurate)
const float CAUCHY_A = 1.5168;
const float CAUCHY_B = 0.00420;

mat3 rotationMatrix(float x, float y, float z) {
    float cx = cos(x);
    float sx = sin(x);
    float cy = cos(y);
    float sy = sin(y);
    float cz = cos(z);
    float sz = sin(z);
    
    mat3 rotX = mat3(1.0, 0.0, 0.0,
                     0.0, cx, -sx,
                     0.0, sx, cx);
    
    mat3 rotY = mat3(cy, 0.0, sy,
                     0.0, 1.0, 0.0,
                     -sy, 0.0, cy);
    
    mat3 rotZ = mat3(cz, -sz, 0.0,
                     sz, cz, 0.0,
                     0.0, 0.0, 1.0);
    
    return rotZ * rotY * rotX;
}

vec3 calculateViewDir() {
    mat3 rotation = rotationMatrix(uRotationX, uRotationY, uRotationZ);
    vec3 baseViewDir = vec3(0.0, 0.0, 1.0);
    return normalize(rotation * baseViewDir);
}

float roundedRectDistance(vec2 uv, vec2 cardSize, float radiusPx) {
    vec2 pixelPos = uv * cardSize;
    vec2 centerPos = cardSize * 0.5;
    
    vec2 halfSize = cardSize * 0.5 - radiusPx;
    vec2 d = abs(pixelPos - centerPos) - halfSize;
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radiusPx;
    
    return dist / min(cardSize.x, cardSize.y);
}

float getMaskValue(vec2 uv) {
    if (uUseMask) {
        float maskValue = texture2D(uBlurredMaskTexture, uv).r;
        return smoothstep(0.46, 0.58, maskValue);
    } else {
        float rectDist = roundedRectDistance(uv, uCardSize, uBorderRadius);
        float edgeSmoothnessPx = uEdgeSmoothness / min(uCardSize.x, uCardSize.y);
        return 1.0 - smoothstep(-edgeSmoothnessPx, edgeSmoothnessPx, rectDist);
    }
}

float getEdgeDistance(vec2 uv) {
    if (uUseMask) {
        float maskValue = texture2D(uBlurredMaskTexture, uv).r;
        // Convert mask value to edge distance - 1.0 is center, 0.0 is edge
        return (maskValue - 0.5) * 2.0;
    } else {
        return roundedRectDistance(uv, uCardSize, uBorderRadius);
    }
}

float interpEdgeThickness(float edgeDistance, float radiusPx, vec2 cardSize, vec2 uv) {
    if (uUseMask) {
        // For masks, keep flat surface in center with thickness variation only at edges
        float maskValue = texture2D(uBlurredMaskTexture, uv).r;
        if (maskValue > 0.8) {
            // Center area - keep flat with maximum thickness
            return GLASS_THICKNESS_MAX * uThickness;
        } else {
            // Edge area - vary thickness based on mask edge distance
            float edgeThickness = smoothstep(0.0, 0.8, maskValue);
            return mix(GLASS_THICKNESS_MIN, GLASS_THICKNESS_MAX, edgeThickness) * uThickness;
        }
    } else {
        float normalizedRadius = radiusPx / min(cardSize.x, cardSize.y);
        float edgeInfluence = smoothstep(-normalizedRadius * 0.5, normalizedRadius * 0.5, edgeDistance);
        
        float baseThickness = mix(GLASS_THICKNESS_MIN, GLASS_THICKNESS_MAX, edgeInfluence);
        return baseThickness * uThickness;
    }
}

float fresnel(vec3 normal, vec3 viewDir, float ior) {
    float cosTheta = abs(dot(normal, viewDir));
    float f0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

vec3 calculateNormal(vec2 uv, float edgeDistance, float thickness, vec2 cardSize) {
    vec3 normal = vec3(0.0, 0.0, 1.0);
    
    if (uUseMask) {
        vec2 texelSize = 1.0 / uCardSize;
        
        // Sample neighboring mask values to calculate the surface gradient
        float left = texture2D(uBlurredMaskTexture, uv - vec2(texelSize.x, 0.0)).r;
        float right = texture2D(uBlurredMaskTexture, uv + vec2(texelSize.x, 0.0)).r;
        float up = texture2D(uBlurredMaskTexture, uv - vec2(0.0, texelSize.y)).r;
        float down = texture2D(uBlurredMaskTexture, uv + vec2(0.0, texelSize.y)).r;
        
        vec2 gradient = vec2(right - left, down - up);

        // **KEY FIX for TIR artifacts**
        // We create a normal from the gradient, but then clamp its xy components.
        // This prevents the normal from becoming too steep, which is what causes
        // the refract() function to fail and produce rainbow artifacts at the edges.
        // Masks use a higher strength so a narrow bevel still bends the backdrop.
        float strength = 8.0;
        float max_tilt = 0.65;
        
        vec3 gradient_normal = vec3(gradient * strength, 1.0);
        gradient_normal.xy = clamp(gradient_normal.xy, -max_tilt, max_tilt);

        normal = normalize(gradient_normal);
        
    } else { // Keep original logic for the default rounded rectangle
        vec2 fromCenter = (uv - 0.5) * 2.0;
        float normalizedRadius = uBorderRadius / min(cardSize.x, cardSize.y);
        float edgeInfluence = smoothstep(-normalizedRadius, 0.0, edgeDistance);
        
        if (edgeInfluence > 0.0) {
            vec2 edgeGradient = normalize(fromCenter);
            float curvature = edgeInfluence * thickness * 2.0;
            normal = normalize(vec3(edgeGradient * curvature, 1.0));
        }
    }
    
    // Apply rotation to the final normal
    mat3 rotation = rotationMatrix(uRotationX, uRotationY, uRotationZ);
    normal = normalize(rotation * normal);
    
    return normal;
}

float calculateSpecular(vec3 normal, vec3 viewDir, vec2 lightPos, vec2 fragPos) {
    vec3 lightDir = normalize(vec3(lightPos - fragPos, 0.5));
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float specAngle = max(dot(normal, halfwayDir), 0.0);
    return pow(specAngle, uSpecularShininess);
}



// Accurate Cauchy dispersion formula for glass
float cauchyIOR(float lambda) {
    return CAUCHY_A + CAUCHY_B / (lambda * lambda);
}



float calculateEdgeHighlight(vec2 uv, float edgeDistance, vec2 lightPos, vec2 cardSize, bool isDark) {
    vec2 fromCenter = (uv - 0.5) * 2.0;
    vec2 lightFromCenter = (lightPos - 0.5) * 2.0;
    
    if (isDark) {
        lightFromCenter = -lightFromCenter;
    }
    
    float fromLen = length(fromCenter);
    float alignment = fromLen > 0.001
        ? dot(fromCenter / fromLen, normalize(lightFromCenter))
        : 0.0;
    
    float isNearEdge;
    if (uUseMask) {
        // Thickness stays high across a masked shape, so the rect highlight
        // was lighting the whole interior. Keep the glint on the bevel.
        float maskValue = texture2D(uBlurredMaskTexture, uv).r;
        isNearEdge = smoothstep(0.25, 0.55, maskValue) * (1.0 - smoothstep(0.72, 0.96, maskValue));
    } else {
        float edgeInfluence = interpEdgeThickness(edgeDistance, uBorderRadius, cardSize, uv);
        isNearEdge = smoothstep(0.3, 0.8, edgeInfluence);
    }
    
    float highlightWidth = uUseMask ? 0.62 : 0.15;
    float highlight = smoothstep(1.0 - highlightWidth, 1.0, alignment) * isNearEdge;
    
    return highlight;
}

void main() {
    vec2 uv = vTexCoord;
    
    // Calculate background UV coordinates based on document-relative position
    vec2 backgroundUV = uOffset + uv * uScale;
    
    // Clamp the background UV coordinates to valid range
    backgroundUV = clamp(backgroundUV, 0.0, 1.0);
    
    float mask = getMaskValue(uv);
    float edgeDistance = getEdgeDistance(uv);
    
    float thickness = interpEdgeThickness(edgeDistance, uBorderRadius, uCardSize, uv);
    vec3 surfaceNormal = calculateNormal(uv, edgeDistance, thickness, uCardSize);
    vec3 viewDir = calculateViewDir();
    
    // Base refraction using the main IOR (always present)
    float baseIORRatio = AIR_IOR / uIOR;
    vec3 baseRefractDir = refract(-viewDir, surfaceNormal, baseIORRatio);
    vec2 baseDisplacement = baseRefractDir.xy * thickness * 0.1;
    
    // Enhanced chromatic aberration with wavelength-dependent dispersion
    float distanceFromCenter = length(uv - 0.5);
    float aberrationStrength = uChromaticAberration * (0.3 + distanceFromCenter * 0.7);
    
    // Calculate wavelength-specific IOR values using Cauchy dispersion
    float iorRed = uIOR + (cauchyIOR(LAMBDA_RED) - CAUCHY_A) * aberrationStrength;
    float iorGreen = uIOR + (cauchyIOR(LAMBDA_GREEN) - CAUCHY_A) * aberrationStrength;
    float iorBlue = uIOR + (cauchyIOR(LAMBDA_BLUE) - CAUCHY_A) * aberrationStrength;
    float iorViolet = uIOR + (cauchyIOR(LAMBDA_VIOLET) - CAUCHY_A) * aberrationStrength;
    
    float iorRatioR = AIR_IOR / iorRed;
    float iorRatioG = AIR_IOR / iorGreen;
    float iorRatioB = AIR_IOR / iorBlue;
    float iorRatioV = AIR_IOR / iorViolet;
    
    vec3 refractDirR = refract(-viewDir, surfaceNormal, iorRatioR);
    vec3 refractDirG = refract(-viewDir, surfaceNormal, iorRatioG);
    vec3 refractDirB = refract(-viewDir, surfaceNormal, iorRatioB);
    vec3 refractDirV = refract(-viewDir, surfaceNormal, iorRatioV);
    
    // Combine base displacement with chromatic aberration
    vec2 displacementR = baseDisplacement + (refractDirR.xy - baseRefractDir.xy) * thickness * 0.15;
    vec2 displacementG = baseDisplacement + (refractDirG.xy - baseRefractDir.xy) * thickness * 0.15;
    vec2 displacementB = baseDisplacement + (refractDirB.xy - baseRefractDir.xy) * thickness * 0.15;
    vec2 displacementV = baseDisplacement + (refractDirV.xy - baseRefractDir.xy) * thickness * 0.15;
    
    vec2 uvR = clamp(backgroundUV + displacementR, 0.0, 1.0);
    vec2 uvG = clamp(backgroundUV + displacementG, 0.0, 1.0);
    vec2 uvB = clamp(backgroundUV + displacementB, 0.0, 1.0);
    vec2 uvV = clamp(backgroundUV + displacementV, 0.0, 1.0);
    
    // Sample refracted colors (frosting is pre-processed in JavaScript)
    vec3 colorR = texture2D(uFrostedTexture, uvR).rgb;
    vec3 colorG = texture2D(uFrostedTexture, uvG).rgb;
    vec3 colorB = texture2D(uFrostedTexture, uvB).rgb;
    
    float r = colorR.r;
    float g = colorG.g;
    float b = colorB.b;
    
    vec3 refractedColor = vec3(r, g, b);
    refractedColor = mix(refractedColor, vec3(1.0), uGlassOpacity * 0.5);
    
    // Simple fresnel-based reflections
    float fresnelAmount = fresnel(surfaceNormal, viewDir, uIOR);
    vec3 reflectedColor = mix(refractedColor, vec3(0.9, 0.95, 1.0), fresnelAmount * 0.2);
    
    // Calculate specular highlight
    vec2 fragPos = backgroundUV;
    float specularHighlight = calculateSpecular(surfaceNormal, viewDir, uLightPosition, fragPos);
    
    // Edge highlights
    float lightHighlight = calculateEdgeHighlight(uv, edgeDistance, uLightPosition, uCardSize, false);
    float darkHighlight = calculateEdgeHighlight(uv, edgeDistance, uLightPosition, uCardSize, true);
    
    vec3 finalColor = reflectedColor;
    
    // Add specular highlights
    vec3 specularColor = vec3(1.0, 0.95, 0.9);
    float specularAmount = specularHighlight * uLightStrength * 0.3;
    finalColor = mix(finalColor, specularColor, specularAmount);
    
    // Edge lighting effects
    vec3 lightTint = mix(finalColor, vec3(0.95, 0.98, 1.0), 0.7);
    vec3 darkTint = finalColor * 0.3;
    
    finalColor = mix(finalColor, lightTint, lightHighlight * uLightStrength * 0.3);
    finalColor = mix(finalColor, darkTint, darkHighlight * uLightStrength * 0.15);
    
    // Apply tint
    finalColor = mix(finalColor, finalColor * uTintColor, uTintStrength);

    // The WebGL canvas is premultiplied. Alpha has to scale the color,
    // or the page divides by 0.8 and the glass clips to white.
    float finalAlpha = mask * (0.97 + uGlassOpacity * 0.03);
    
    gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}`;
  }

  async init(options = {}) {
    if (this.isInitialized) return;

    const { ignoreElements = [] } = options;

    if (this.sourceInstance) {
      this.capturedImage = this.sourceInstance.capturedImage;
      this.lowResImage = this.sourceInstance.lowResImage;
      this.p5ImageLoader = this.sourceInstance.p5ImageLoader;
      this.documentWidth = this.sourceInstance.documentWidth;
      this.documentHeight = this.sourceInstance.documentHeight;
    } else {
      this.createImageLoader();
      await this.captureBackground(ignoreElements);
    }
    this.setupResizeListener();

    this.isInitialized = true;
  }

  createImageLoader() {
    if (this.p5ImageLoader) {
      return this._loaderReady || Promise.resolve();
    }

    let holder = document.getElementById("realglass-loader");

    if (!holder) {
      holder = document.createElement("div");
      holder.id = "realglass-loader";
      holder.setAttribute("data-html2canvas-ignore", "true");
      holder.style.cssText =
        "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
      document.body.appendChild(holder);
    }

    this._loaderReady = new Promise((resolve) => {
      const sketch = (p) => {
        p.setup = () => {
          p.pixelDensity(1);
          p.createCanvas(1, 1);
          resolve();
        };
      };

      this.p5ImageLoader = new p5(sketch, holder);
    });

    return this._loaderReady;
  }

  _html2canvas() {
    const capture = window.html2canvas;

    if (typeof capture !== "function") {
      throw new Error("html2canvas is not loaded");
    }

    return capture;
  }

  async captureBackground(ignoreElements = []) {
    try {
      // Get full document dimensions
      const body = document.body;
      const html = document.documentElement;
      this.documentHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      this.documentWidth = Math.max(
        body.scrollWidth,
        body.offsetWidth,
        html.clientWidth,
        html.scrollWidth,
        html.offsetWidth
      );

      const canvas = await this._html2canvas()(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: this.documentWidth,
        height: this.documentHeight,
        scale: window.devicePixelRatio,
        ignoreElements: (element) => {
          return ignoreElements.includes(element);
        },
        onclone: this.onclone,
      });

      const dataURL = canvas.toDataURL("image/png");
      this.capturedImage = await this.loadImageFromDataURL(dataURL);
      this.lowResImage = await this.createBlurredVersion(canvas);
    } catch (error) {
      console.error("Failed to capture background:", error);
    }
  }

  async createBlurredVersion(originalCanvas) {
    const scale = 0.25;
    const blurredCanvas = document.createElement("canvas");
    blurredCanvas.width = originalCanvas.width * scale;
    blurredCanvas.height = originalCanvas.height * scale;

    const ctx = blurredCanvas.getContext("2d");
    ctx.filter = "blur(8px)";
    ctx.drawImage(
      originalCanvas,
      0,
      0,
      blurredCanvas.width,
      blurredCanvas.height
    );

    return this.loadImageFromDataURL(blurredCanvas.toDataURL("image/png"));
  }

  async loadMaskFromImage(imageSource) {
    let image;

    if (typeof imageSource === "string") {
      image = await this.loadImageFromDataURL(imageSource);
    } else if (imageSource instanceof HTMLImageElement) {
      const canvas = document.createElement("canvas");
      canvas.width = imageSource.naturalWidth;
      canvas.height = imageSource.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imageSource, 0, 0);
      image = await this.loadImageFromDataURL(canvas.toDataURL("image/png"));
    } else if (imageSource instanceof HTMLCanvasElement) {
      image = await this.loadImageFromDataURL(
        imageSource.toDataURL("image/png")
      );
    } else {
      throw new Error("Unsupported image source type");
    }

    // Process the canvas of the loaded p5.Image to invert the mask
    const canvas = image.canvas;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]; // Get the original alpha (0-255)
      // Invert: transparent (0) -> white (255), opaque (255) -> black (0)
      const invertedAlpha = alpha;
      data[i] = invertedAlpha; // R
      data[i + 1] = invertedAlpha; // G
      data[i + 2] = invertedAlpha; // B
      data[i + 3] = 255; // Set alpha to full so the texture is opaque
    }
    ctx.putImageData(imageData, 0, 0);

    // Create a new p5.Image from the modified canvas data to ensure texture updates
    const modifiedDataURL = canvas.toDataURL("image/png");
    return this.loadImageFromDataURL(modifiedDataURL);
  }

  async loadMaskFromElement(element) {
    try {
      const canvas = await this._html2canvas()(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 1,
      });

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const ctx = maskCanvas.getContext("2d");

      ctx.drawImage(canvas, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]; // Get the original alpha (0-255)
          // Invert: transparent (0) -> white (255), opaque (255) -> black (0)
          const invertedAlpha = alpha;
          data[i] = invertedAlpha; // R
          data[i + 1] = invertedAlpha; // G
          data[i + 2] = invertedAlpha; // B
          data[i + 3] = 255; // Set alpha to full so the texture is opaque
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return this.loadImageFromDataURL(maskCanvas.toDataURL("image/png"));
    } catch (error) {
      console.error("Failed to create mask from element:", error);
      throw error;
    }
  }

  async createBlurredMask(maskImage, blurRadius = 10) {
    if (!maskImage || !this.p5ImageLoader) return null;

    const canvas = document.createElement("canvas");
    canvas.width = maskImage.width;
    canvas.height = maskImage.height;
    const ctx = canvas.getContext("2d");

    // Apply blur filter
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(maskImage.canvas, 0, 0);

    return this.loadImageFromDataURL(canvas.toDataURL("image/png"));
  }

  async createFrostedTexture(sourceImage, blurRadius = 0) {
    if (!sourceImage || blurRadius <= 0) return sourceImage;

    const canvas = document.createElement("canvas");
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;
    const ctx = canvas.getContext("2d");

    // Apply blur filter for frosting effect
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(sourceImage.canvas, 0, 0);

    return this.loadImageFromDataURL(canvas.toDataURL("image/png"));
  }

  async usePlate(sourceCanvas) {
    await this.createImageLoader();
    this.plateMode = true;

    const plateWidth = sourceCanvas.width;
    const plateHeight = sourceCanvas.height;

    if (
      !this.capturedImage ||
      this.capturedImage.width !== plateWidth ||
      this.capturedImage.height !== plateHeight
    ) {
      this.capturedImage = this.p5ImageLoader.createImage(
        plateWidth,
        plateHeight
      );
      this.lowResImage = this.p5ImageLoader.createImage(
        Math.max(1, Math.round(plateWidth * 0.25)),
        Math.max(1, Math.round(plateHeight * 0.25))
      );
    }

    this._blit(this.capturedImage, sourceCanvas);
    this._blit(this.lowResImage, sourceCanvas, "blur(8px)");
    this.documentWidth = plateWidth;
    this.documentHeight = plateHeight;
    this.isInitialized = true;
  }

  setMaskCanvas(sourceCanvas, blurRadius) {
    const processed = this._alphaMask(sourceCanvas);
    const maskWidth = processed.width;
    const maskHeight = processed.height;

    if (
      !this.maskTexture ||
      this.maskTexture.width !== maskWidth ||
      this.maskTexture.height !== maskHeight
    ) {
      this.maskTexture = this.p5ImageLoader.createImage(
        maskWidth,
        maskHeight
      );
      this.blurredMaskTexture = this.p5ImageLoader.createImage(
        maskWidth,
        maskHeight
      );
    }

    this._blit(this.maskTexture, processed);

    const radius = Math.max(blurRadius || 0, 0);
    this._blit(
      this.blurredMaskTexture,
      processed,
      radius > 0 ? `blur(${radius}px)` : "none"
    );
  }

  _alphaMask(sourceCanvas) {
    if (!this._maskScratch) {
      this._maskScratch = document.createElement("canvas");
    }

    const canvas = this._maskScratch;
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      data[i] = alpha;
      data[i + 1] = alpha;
      data[i + 2] = alpha;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  _blit(image, sourceCanvas, filter) {
    const ctx = image.drawingContext;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, image.width, image.height);
    ctx.filter = filter && filter !== "none" ? filter : "none";
    ctx.drawImage(sourceCanvas, 0, 0, image.width, image.height);
    ctx.filter = "none";
    image.setModified(true);
  }

  _bindSampler(name, image) {
    if (!this.shaderProgram || !image) {
      return;
    }

    if (image.isModified && image.isModified()) {
      const uniform = this.shaderProgram.uniforms[name];

      if (uniform) {
        uniform._cachedData = undefined;
      }
    }

    this.shaderProgram.setUniform(name, image);
  }

  _frostedPlate(parameters) {
    const frosting = parameters.frosting || 0;

    if (frosting <= 0 || !this.capturedImage) {
      return this.capturedImage;
    }

    const frostingRadius = Math.max(1, frosting * 20);

    if (
      !this.frostTexture ||
      this.frostTexture.width !== this.capturedImage.width ||
      this.frostTexture.height !== this.capturedImage.height
    ) {
      this.frostTexture = this.p5ImageLoader.createImage(
        this.capturedImage.width,
        this.capturedImage.height
      );
    }

    this._blit(
      this.frostTexture,
      this.capturedImage.canvas,
      `blur(${frostingRadius}px)`
    );

    return this.frostTexture;
  }

  loadImageFromDataURL(dataURL) {
    return new Promise((resolve, reject) => {
      if (!this.p5ImageLoader) {
        reject(new Error("p5 image loader not initialized"));
        return;
      }

      const img = this.p5ImageLoader.loadImage(
        dataURL,
        (loadedImage) => {
          resolve(loadedImage);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  setupResizeListener() {
    const debouncedResize = () => {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = setTimeout(async () => {
        await this.captureBackground();
        if (this.targetElement) {
          await this.apply(this.targetElement, this.currentParameters);
        }
      }, 300);
    };

    window.addEventListener("resize", debouncedResize);

    // Add scroll listener
    window.addEventListener("scroll", () => {
      this.scrollX = window.scrollX;
      this.scrollY = window.scrollY;
    });
  }

  async apply(element, parameters = {}) {
    if (!this.isInitialized) {
      console.error("RealGlass must be initialized before applying");
      return;
    }

    this.targetElement = element;
    this.currentParameters = parameters;
    const rect = element.getBoundingClientRect();

    // Process mask if provided
    let maskWidth = Math.round(rect.width);
    let maskHeight = Math.round(rect.height);
    let useMask = false;

    if (parameters.maskImage || parameters.maskElement) {
      try {
        if (parameters.maskElement) {
          this.maskTexture = await this.loadMaskFromElement(
            parameters.maskElement
          );
        } else if (parameters.maskImage) {
          this.maskTexture = await this.loadMaskFromImage(parameters.maskImage);
        }

        if (this.maskTexture) {
          const blurRadius = parameters.maskSmoothing
            ? parameters.maskSmoothing * 20
            : 10;
          this.blurredMaskTexture = await this.createBlurredMask(
            this.maskTexture,
            blurRadius
          );
          useMask = true;
        }
      } catch (error) {
        console.error("Failed to load mask:", error);
      }
    }

    // Create frosted texture (always create one, even if frosting is 0)
    let frostedTexture;
    try {
      if (this.plateMode) {
        frostedTexture = this._frostedPlate(parameters);
      } else if (parameters.frosting && parameters.frosting > 0) {
        const frostingRadius = Math.max(1, parameters.frosting * 20); // Scale frosting value to pixel radius (1-20px)
        frostedTexture = await this.createFrostedTexture(
          this.capturedImage,
          frostingRadius
        );
      } else {
        frostedTexture = this.capturedImage; // No frosting, use original
      }
    } catch (error) {
      console.error("Failed to create frosted texture:", error);
      frostedTexture = this.capturedImage;
    }

    const config = {
      width: maskWidth,
      height: maskHeight,
      chromaticAberration: 0.5,
      frosting: 0,
      glassOpacity: 0.0,
      lightStrength: 2.175,
      lightX: 0.7,
      lightY: 0.3,
      edgeSmoothness: 2.0,
      ior: 1.52,
      borderRadius: 50,
      specularShininess: 32,
      thickness: 1.0,
      rotationX: 0.0,
      rotationY: 0.0,
      rotationZ: 0.0,
      scaleTransform: 1.0,
      tintColor: [1.0, 1.0, 1.0],
      tintStrength: 0.0,
      useMask: useMask,
      maskSmoothing: 0.15,
      maskSmoothingInset: 0.1,
      ...parameters,
    };

    // Convert tintColor if it's a hex string
    if (
      typeof config.tintColor === "string" &&
      config.tintColor.startsWith("#")
    ) {
      const hex = config.tintColor;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      config.tintColor = [r, g, b];
    }

    this.view = {
      element,
      config,
      frostedTexture
    };

    const density = this.renderDensity || window.devicePixelRatio || 1;
    const sameSize =
      this.p5Instance &&
      this.canvasContainer &&
      this._appliedWidth === config.width &&
      this._appliedHeight === config.height &&
      this._appliedDensity === density;

    element.setAttribute("data-html2canvas-ignore", "true");
    element.style.background = "transparent";
    element.style.borderRadius = `${config.borderRadius}px`;

    if (sameSize) {
      return this.p5Instance;
    }

    this._appliedWidth = config.width;
    this._appliedHeight = config.height;
    this._appliedDensity = density;

    if (!this.plateMode) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    // Make element transparent so canvas shows through

    // Create canvas container positioned behind element
    if (this.canvasContainer) {
      this.canvasContainer.remove();
    }

    const Z_INDEX = 1000;
    this.canvasContainer = document.createElement("div");
    this.canvasContainer.setAttribute("data-html2canvas-ignore", "true");

    // Match positioning of the target element
    const elementStyle = window.getComputedStyle(element);
    if (elementStyle.position === "fixed") {
      this.canvasContainer.style.position = "fixed";
    } else {
      this.canvasContainer.style.position = "absolute";
    }

    this.canvasContainer.style.left = `${rect.left}px`;
    this.canvasContainer.style.top = `${rect.top}px`;
    this.canvasContainer.style.width = `${config.width}px`;
    this.canvasContainer.style.height = `${config.height}px`;
    this.canvasContainer.style.borderRadius = `${config.borderRadius}px`;
    this.canvasContainer.style.overflow = "hidden";
    this.canvasContainer.style.zIndex = Z_INDEX - 1;
    element.style.zIndex = Z_INDEX;
    this.canvasContainer.style.pointerEvents = "none";

    document.body.appendChild(this.canvasContainer);

    if (this.p5Instance) {
      this.p5Instance.remove();
    }

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(config.width, config.height, p.WEBGL);
        p.pixelDensity(this.renderDensity || window.devicePixelRatio || 1);
        p.noStroke();

        this.shaderProgram = p.createShader(
          this.vertexShaderSource,
          this.fragmentShaderSource
        );
      };

      p.draw = () => {
        const view = this.view;

        if (
          !view ||
          !this.capturedImage ||
          !this.lowResImage ||
          !this.shaderProgram ||
          !view.frostedTexture
        ) {
          return;
        }

        const element = view.element;
        const config = view.config;
        const frostedTexture = view.frostedTexture;

        // Update canvas position to follow element
        let currentRect = element.getBoundingClientRect();

        // Calculate offsets including scroll position
        const elementStyle = window.getComputedStyle(element);
        const isFixed = elementStyle.position === "fixed";

        this.canvasContainer.style.top = `${
          currentRect.top + (!isFixed ? this.scrollY : 0)
        }px`;
        this.canvasContainer.style.left = `${
          currentRect.left + (!isFixed ? this.scrollX : 0)
        }px`;

        // A plate is already the element's own picture, so it fills the card.
        // A document capture is addressed from the element's page position.
        let offsetX = 0;
        let offsetY = 0;
        let scaleX = 1;
        let scaleY = 1;

        if (!this.plateMode) {
          offsetX = (currentRect.left + this.scrollX) / this.documentWidth;
          offsetY = (currentRect.top + this.scrollY) / this.documentHeight;
          scaleX = config.width / this.documentWidth;
          scaleY = config.height / this.documentHeight;
        }

        p.shader(this.shaderProgram);

        this._bindSampler("uTexture", this.capturedImage);
        this._bindSampler("uLowResTexture", this.lowResImage);
        this._bindSampler("uFrostedTexture", frostedTexture);

        if (config.useMask && this.maskTexture && this.blurredMaskTexture) {
          this._bindSampler("uMaskTexture", this.maskTexture);
          this._bindSampler("uBlurredMaskTexture", this.blurredMaskTexture);
        } else {
          this._bindSampler("uMaskTexture", this.capturedImage);
          this._bindSampler("uBlurredMaskTexture", this.capturedImage);
        }

        this.shaderProgram.setUniform("uResolution", [p.width, p.height]);
        this.shaderProgram.setUniform("uTime", 0);
        this.shaderProgram.setUniform("uOffset", [offsetX, offsetY]);
        this.shaderProgram.setUniform("uScale", [scaleX, scaleY]);
        this.shaderProgram.setUniform(
          "uChromaticAberration",
          config.chromaticAberration
        );
        this.shaderProgram.setUniform("uGlassOpacity", config.glassOpacity);
        this.shaderProgram.setUniform("uLightStrength", config.lightStrength);
        this.shaderProgram.setUniform("uLightPosition", [
          config.lightX,
          config.lightY,
        ]);
        this.shaderProgram.setUniform("uEdgeSmoothness", config.edgeSmoothness);
        this.shaderProgram.setUniform("uIOR", config.ior);
        this.shaderProgram.setUniform("uBorderRadius", config.borderRadius);
        this.shaderProgram.setUniform(
          "uSpecularShininess",
          config.specularShininess
        );
        this.shaderProgram.setUniform("uCardSize", [
          config.width,
          config.height,
        ]);
        this.shaderProgram.setUniform("uThickness", config.thickness);
        this.shaderProgram.setUniform("uTintColor", config.tintColor);
        this.shaderProgram.setUniform("uTintStrength", config.tintStrength);
        this.shaderProgram.setUniform("uRotationX", config.rotationX);
        this.shaderProgram.setUniform("uRotationY", config.rotationY);
        this.shaderProgram.setUniform("uRotationZ", config.rotationZ);
        this.shaderProgram.setUniform("uScaleTransform", config.scaleTransform);
        this.shaderProgram.setUniform("uUseMask", config.useMask);
        this.shaderProgram.setUniform(
          "uMaskSmoothingInset",
          config.maskSmoothingInset
        );

        p.plane(config.width, config.height);
      };
    };

    this.p5Instance = new p5(sketch, this.canvasContainer);
    return this.p5Instance;
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }

    if (this.canvasContainer) {
      this.canvasContainer.remove();
      this.canvasContainer = null;
    }

    // Clean up mask textures. p5.Image has no remove(); the GL context goes
    // away with the instance above.
    this.maskTexture = null;
    this.blurredMaskTexture = null;
    this.frostTexture = null;
    this.shaderProgram = null;
    this.view = null;
    this.plateMode = false;
    this._appliedWidth = 0;
    this._appliedHeight = 0;

    // Only clean up shared resources if this isn't using a source instance
    if (!this.sourceInstance) {
      if (this.p5ImageLoader) {
        this.p5ImageLoader.remove();
        this.p5ImageLoader = null;
      }

      this._loaderReady = null;
      this.capturedImage = null;
      this.lowResImage = null;

      clearTimeout(this.resizeDebounceTimer);
    }

    this.isInitialized = false;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = RealGlass;
}

if (typeof window !== "undefined") {
  window.RealGlass = RealGlass;
}
