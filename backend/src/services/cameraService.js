const mockCamera = require("../data/mockCamera.json");

async function getCameraRiskForCoordinates(lat, lon) {
  try {
    /*
      JAIDEN INTEGRATION GOES HERE LATER.

      Expected Jaiden function shape:

      const camera = await jaidenGetCameraRisk(lat, lon);

      Expected return:
      {
        camera_id: "UCSD-Ridge-East",
        camera_available: true,
        smoke_detected: true,
        fire_detected: false,
        visibility_status: "reduced",
        camera_caption: "Smoke increasing near eastern ridge.",
        image_url: "/sample-camera/ridge-east.jpg"
      }
    */

    return {
      ...mockCamera,
      source: "mock_camera",
      lat,
      lon
    };
  } catch (error) {
    console.error("Camera service failed:", error.message);

    return {
      ...mockCamera,
      source: "mock_camera_fallback",
      lat,
      lon
    };
  }
}

module.exports = {
  getCameraRiskForCoordinates
};