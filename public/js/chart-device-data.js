// this is the frontend file
$(document).ready(() => {
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.batteryVoltageData = new Array(this.maxLen);
      this.soilTemperatureData = new Array(this.maxLen);
      this.soilWaterContentData = new Array(this.maxLen);
      this.soilConductivityData = new Array(this.maxLen);
    }

    addData(time, batteryVoltage, soilTemperature, soilWaterContent, soilConductivity) {
      this.timeData.push(time);
      this.batteryVoltageData.push(batteryVoltage);
      this.soilTemperatureData.push(soilTemperature);
      this.soilWaterContentData.push(soilWaterContent);
      this.soilConductivityData.push(soilConductivity);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.batteryVoltageData.shift();
        this.soilTemperatureData.shift();
        this.soilWaterContentData.shift();
        this.soilConductivityData.shift();
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
    datasets: [
      {
        fill: false,
        label: 'Battery Voltage',
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        data: [],
      },
      {
        fill: false,
        label: 'Soil Temperature',
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        data: [],
      },
      {
        fill: false,
        label: 'Soil Water Content',
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        data: [],
      },
      {
        fill: false,
        label: 'Soil Conductivity',
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        data: [],
      },
    ],
    labels: [],
  };

  const chartOptions = {
    scales: {
      yAxes: [{
        type: 'linear',
        ticks: {
          beginAtZero: true,
        },
      }],
    },
  };

  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: chartOptions,
  });

  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices.value);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.batteryVoltageData;
    chartData.datasets[1].data = device.soilTemperatureData;
    chartData.datasets[2].data = device.soilWaterContentData;
    chartData.datasets[3].data = device.soilConductivityData;
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange);

  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);

      // Extract fields from the incoming message
      const {
        batteryVoltage,
        soilTemperature,
        soilWaterContent,
        soilConductivity,
        MessageDate,
        DeviceId,
      } = messageData;

      // Validate required fields
      if (!MessageDate || !DeviceId) {
        return;
      }

      let device = trackedDevices.findDevice(DeviceId);
      if (!device) {
        device = new DeviceData(DeviceId);
        trackedDevices.devices.push(device);

        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;

        const option = document.createElement('option');
        option.value = DeviceId;
        option.text = DeviceId;
        listOfDevices.add(option);

        if (trackedDevices.getDevicesCount() === 1) {
          listOfDevices.value = DeviceId;
          OnSelectionChange();
        }
      }

      device.addData(MessageDate, batteryVoltage, soilTemperature, soilWaterContent, soilConductivity);
      if (listOfDevices.value === DeviceId) {
        OnSelectionChange();
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  };
});
