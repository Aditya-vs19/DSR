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
  barWidth = 50
}) => {
  const isCircular = type === "pie" || type === "donut";
  const hasCustomDatasets = Array.isArray(datasets) && datasets.length > 0;
  const renderedValues = chartValues || values;
  const dataset = {
    labels,
    datasets: hasCustomDatasets
      ? datasets
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
        ]
  };

  const options = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            const label = context.label ? `${context.label}: ` : "";
            const value = values[context.dataIndex] ?? context.raw;
            return `${label}${value}`;
          }
        }
      },
      legend: { display: isCircular },
      legend: { display: isCircular || hasCustomDatasets },
      title: { display: true, text: title }
    },
    ...(type === "donut" ? { cutout: "65%" } : {}),
    ...(isCircular
      ? {}
      : {
          scales: {
            y: {
              beginAtZero: true,
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
        <div className="mx-auto w-full max-w-[280px]">
          <Doughnut data={dataset} options={options} />
        </div>
      ) : type === "pie" ? (
        <Pie data={dataset} options={options} />
      ) : (
        <Bar data={dataset} options={options} />
      )}
    </div>
  );
};

export default Charts;
