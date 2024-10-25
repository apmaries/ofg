let vegaSpec = {
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "width": 300,
  "height": 360,
  "padding": 5,

  "data": [
    {
      "name": "table",
      "values": intervals.map((x, i) => {
        let y1 = weeklyMode
          ? offeredDaysForWeek[i]
          : offeredIntervalsForDay[i] || 0;
        let y2 = weeklyMode ? ahtDaysForWeek[i] : ahtIntervalsForDay[i] || 0;

        return { x, y1, y2 };
      }),
    },
  ],

  "scales": [
    {
      "name": "x",
      "type": "band",
      "range": "width",
      "domain": { "data": "table", "field": "x" },
      "padding": 0.1,
    },
    {
      "name": "y",
      "type": "linear",
      "range": "height",
      "nice": true,
      "zero": false,
      "domain": { "data": "table", "field": "y1" },
      "domainMin": 0,
    },
    {
      "name": "y2",
      "type": "linear",
      "range": "height",
      "nice": true,
      "zero": false,
      "domain": { "data": "table", "field": "y2" },
      "domainMin": 0,
    },
  ],

  "axes": [
    {
      "orient": "bottom",
      "scale": "x",
      "labelAngle": -90,
      "labelPadding": 10,
      "title": weeklyMode ? "Days" : "Time (hours)",
      "bandPosition": 0.5, // Center the labels between the ticks
      "labelAlign": "center", // Align labels to the center
      "values": weeklyMode
        ? xAxisLabels
        : Array.from(
            { length: 24 },
            (_, i) => `${i.toString().padStart(2, "0")}:00`
          ),
    },
    { "orient": "left", "scale": "y", "title": "Offered" },
    { "orient": "right", "scale": "y2", "title": "Average Handle Time" },
  ],

  "marks": [
    {
      "type": "rect",
      "from": { "data": "table" },
      "encode": {
        "enter": {
          "x": { "scale": "x", "field": "x" },
          "width": { "scale": "x", "band": 1 },
          "y": { "scale": "y", "field": "y1" },
          "y2": { "scale": "y", "value": 0 },
          "fill": { "value": "rgb(31, 119, 180)" },
        },
      },
    },
    {
      "type": "line",
      "from": { "data": "table" },
      "encode": {
        "enter": {
          "x": { "scale": "x", "field": "x", "band": 0.5 },
          "y": { "scale": "y2", "field": "y2" },
          "stroke": { "value": "rgb(255, 127, 14)" },
        },
      },
    },
    weeklyMode
      ? {
          "type": "symbol",
          "from": { "data": "table" },
          "encode": {
            "enter": {
              "x": { "scale": "x", "field": "x", "band": 0.5 },
              "y": { "scale": "y2", "field": "y2" },
              "fill": { "value": "rgb(255, 127, 14)" },
              "size": { "value": 50 },
            },
          },
        }
      : {
          "type": "symbol",
          "from": { "data": "table" },
          "encode": {
            "enter": {
              "x": { "scale": "x", "field": "x", "band": 0.5 },
              "y": { "scale": "y2", "field": "y2" },
              "fill": { "value": "rgb(255, 127, 14)" },
              "size": { "value": 0 },
            },
          },
        },
  ],
};
