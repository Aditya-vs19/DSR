import {
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
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const Charts = ({ type = "bar", title, labels = [], values = [], color = "rgba(79, 70, 229, 0.8)" }) => {
  const dataset = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
        tension: 0.35
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title }
    }
  };

  return <div className="card">{type === "line" ? <Line data={dataset} options={options} /> : <Bar data={dataset} options={options} />}</div>;
};

export default Charts;
