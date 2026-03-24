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
import { Bar, Line, Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const Charts = ({ type = "bar", title, labels = [], values = [], color = "rgba(79, 70, 229, 0.8)" }) => {
  const isPie = type === "pie";
  const dataset = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        backgroundColor: color,
        borderColor: isPie ? "#ffffff" : color,
        borderWidth: isPie ? 2 : 1,
        tension: 0.35
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: isPie },
      title: { display: true, text: title }
    },
    ...(isPie ? {} : { scales: { y: { beginAtZero: true } } })
  };

  return (
    <div className="card">
      {type === "line" ? <Line data={dataset} options={options} /> : type === "pie" ? <Pie data={dataset} options={options} /> : <Bar data={dataset} options={options} />}
    </div>
  );
};

export default Charts;
