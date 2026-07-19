export default function ForecastText({ text }) {
  if (!text) return null;
  return (
    <div className="forecast-text">
      <p>{text}</p>
    </div>
  );
}
