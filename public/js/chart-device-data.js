
$(document).ready(() => {
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.soilTemperatureData = new Array(this.maxLen);
      this.soilWaterContentData = new Array(this.maxLen);
      this.soilConductivityData = new Array(this.maxLen);
      this.soilpH = new Array(this.maxLen);
    }

    addData(time, soilTemperature, soilWaterContent, soilConductivity, soilpH) {
      this.timeData.push(time);
      this.soilTemperatureData.push(soilTemperature);
      this.soilWaterContentData.push(soilWaterContent);
      this.soilConductivityData.push(soilConductivity);
      this.soilpH.push(soilpH);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.soilTemperatureData.shift();
        this.soilWaterContentData.shift();
        this.soilConductivityData.shift();
        this.soilpH.shift();
      }
    }
  }

  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    findDevice(deviceId) {
      return this.devices.find((device) => device.deviceId === deviceId);
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  const chartData = {
    labels: [],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Value',
        },
      },
    },
  };

  // Create individual charts for each variable
  const soilTemperatureCtx = document.getElementById('soilTemperatureChart').getContext('2d');
  const soilWaterContentCtx = document.getElementById('soilWaterContentChart').getContext('2d');
  const soilConductivityCtx = document.getElementById('soilConductivityChart').getContext('2d');
  const soilpHCtx = document.getElementById('soilpHChart').getContext('2d');

  const soilTemperatureChart = new Chart(soilTemperatureCtx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Soil Temperature',
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        data: [],
      }],
      labels: [],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          title: {
            display: true,
            text: 'Temperature (°C)',
          },
        },
      },
    },
  });

  const soilWaterContentChart = new Chart(soilWaterContentCtx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Soil Water Content',
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        data: [],
      }],
      labels: [],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          title: {
            display: true,
            text: 'Soil Water Content [%]',
          },
        },
      },
    },
  });

  const soilConductivityChart = new Chart(soilConductivityCtx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Electrical Conductivity',
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        data: [],
      }],
      labels: [],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          title: {
            display: true,
            text: 'Electrical Conductivity [µS/cm]',
          },
        },
      },
    },
  });

  const soilpHChart = new Chart(soilpHCtx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Soil pH',
        borderColor: 'rgba(0, 255, 0, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        data: [],
      }],
      labels: [],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          title: {
            display: true,
            text: 'pH',
          },
        },
      },
    },
  });

  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');

  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices.value);
    if (device) {
      soilTemperatureChart.data.labels = device.timeData;
      soilTemperatureChart.data.datasets[0].data = device.soilTemperatureData;
      soilTemperatureChart.update();

      soilWaterContentChart.data.labels = device.timeData;
      soilWaterContentChart.data.datasets[0].data = device.soilWaterContentData;
      soilWaterContentChart.update();

      soilConductivityChart.data.labels = device.timeData;
      soilConductivityChart.data.datasets[0].data = device.soilConductivityData;
      soilConductivityChart.update();

      soilpHChart.data.labels = device.timeData;
      soilpHChart.data.datasets[0].data = device.soilpH;
      soilpHChart.update();
    }
  }

  listOfDevices.addEventListener('change', OnSelectionChange);

  webSocket.onmessage = function onMessage(message) {
    console.log('WebSocket message received:', message.data);

    try {
      const messageData = JSON.parse(message.data);

      const {
        date,
        deviceId,
        soilTemperature,
        soilWaterContent,
        soilConductivity,
        pH
      } = messageData;

      if (!date || !deviceId) {
        return;
      }

      let device = trackedDevices.findDevice(deviceId);
      if (!device) {
        device = new DeviceData(deviceId);
        trackedDevices.devices.push(device);

        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;

        const option = document.createElement('option');
        option.value = deviceId;
        option.text = deviceId;
        listOfDevices.add(option);

        if (trackedDevices.getDevicesCount() === 1) {
          listOfDevices.value = deviceId;
          OnSelectionChange();
        }
      }

      device.addData(date, soilTemperature, soilWaterContent, soilConductivity, pH);

      if (listOfDevices.value === deviceId) {
        OnSelectionChange();
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  };
});
