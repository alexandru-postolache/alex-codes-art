class ColorGenerator {
    constructor(colorString) {
        this.color = color(colorString);
        this.h = hue(this.color);
        this.s = saturation(this.color);
        this.b = brightness(this.color);
    }

    getShades(nr) {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let result = [];
        let equalDifference = this.b / nr;
        for (let i = 0; i < nr; i++) {
            result.push(color(this.h, this.s, this.b - (i * equalDifference)));
        }
        pop();
        return result;
    }

    getTints(nr) {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let result = [];
        let equalDifferenceBrightness = (100 - this.b) / nr;
        let equalDifferenceSaturation = this.s / nr;

        for (let i = 0; i < nr; i++) {
            result.push(color(this.h, this.s - (i * equalDifferenceSaturation), this.b + (i * equalDifferenceBrightness)));
        }
        pop();
        return result;
    }

    getMonochromatic(nr) {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let result = [];
        let equalDifference = this.s / nr;
        for (let i = 0; i < nr; i++) {
            result.push(color(this.h, this.s - (i * equalDifference), this.b));
        }
        pop();
        return result;
    }

    getComplementary() {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let complementaryColor = color((this.h + 180) % 360, this.s, this.b);
        pop();
        return complementaryColor;
    }

    getTriadic() {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let triadicColors = [
            color((this.h + 120) % 360, this.s, this.b),
            color((this.h + 240) % 360, this.s, this.b)
        ];
        pop();
        return triadicColors;
    }

    getAnalogous(degree = 30) {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let analogousColors = [
            color((this.h - degree + 360) % 360, this.s, this.b),
            color((this.h + degree) % 360, this.s, this.b)
        ];
        pop();
        return analogousColors;
    }

    getSplitComplementary(degree = 30) {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let splitComplementaryColors = [
            color((this.h + 180 - degree + 360) % 360, this.s, this.b),
            color((this.h + 180 + degree) % 360, this.s, this.b)
        ];
        pop();
        return splitComplementaryColors;
    }

    getTetradic() {
        push();
        colorMode(HSB, 360, 100, 100, 1);
        let tetradicColors = [
            color((this.h + 90) % 360, this.s, this.b),
            color((this.h + 180) % 360, this.s, this.b),
            color((this.h + 270) % 360, this.s, this.b)
        ];
        pop();
        return tetradicColors;
    }
}