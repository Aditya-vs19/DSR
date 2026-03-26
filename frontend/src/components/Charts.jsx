import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip
} from "chart.js";
import { Bar, Doughnut, Line, Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const Charts = ({
  type = "bar",
  title,
  labels = [],
  values = [],
  datasets = null,
  chartValues = null,
  color = "rgba(79, 70, 229, 0.8)",
  barWidth = 50,
  xAxisTitle = "",
  yAxisTitle = ""
}) => {
  const isCircular = type === "pie" || type === "donut";
  const hasCustomDatasets = Array.isArray(datasets) && datasets.length > 0;
  const renderedValues = chartValues || values;
  const renderedDatasets = hasCustomDatasets
    ? datasets.map((entry) => ({
        tension: 2,
        ...(type === "bar"
          ? {
              maxBarThickness: 24,
              categoryPercentage: 0.72,
              barPercentage: 0.78
            }
          : {}),
        ...entry
      }))
    : [
        {
          label: title,
          data: renderedValues,
          backgroundColor: color,
          borderColor: isCircular ? "#ffffff" : color,
          borderWidth: isCircular ? 2 : 1,
          tension: 2,
          ...(type === "bar"
            ? {
                barThickness: barWidth,
                categoryPercentage: 0.72,
                barPercentage: 0.78
              }
            : {})
        }
      ];

  const dataset = {
    labels,
    datasets: renderedDatasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 8,
        right: 8,
        left: 8,
        bottom: 8
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            const datasetLabel = context.dataset?.label ? `${context.dataset.label}: ` : "";
            return `${datasetLabel}${context.raw}`;
          }
        }
      },
      legend: {
        display: isCircular || hasCustomDatasets,
        position: "top",
        align: "center",
        labels: {
          boxWidth: 18,
          boxHeight: 10,
          padding: 14
        }
      },
      title: { display: true, text: title }
    },
    ...(type === "donut" ? { cutout: "65%" } : {}),
    ...(isCircular
      ? {}
      : {
          scales: {
            x: {
              ticks: {
                maxRotation: 0,
                minRotation: 0
              },
              title: {
                display: Boolean(xAxisTitle),
                text: xAxisTitle
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: Boolean(yAxisTitle),
                text: yAxisTitle
              },
              ticks: {
                stepSize: 1,
                precision: 0
              }
            }
          }
        })
  };

  return (
    <div className="card">
      {type === "line" ? (
        <Line data={dataset} options={options} />
      ) : type === "donut" ? (
        <div className="mx-auto h-[280px] w-full max-w-[280px]">
          <Doughnut data={dataset} options={options} />
        </div>
      ) : type === "pie" ? (
        <Pie data={dataset} options={options} />
      ) : (
        <div className="h-[340px] w-full">
          <Bar data={dataset} options={options} />
        </div>
      )}
    </div>
  );
};

export default Charts;
