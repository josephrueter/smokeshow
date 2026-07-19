export default function Explainer() {
  return (
    <div className="explainer">
      <h2>Why is smoke so hard to forecast?</h2>
      <p>
        Forecasting smoke is like forecasting weather — with three extra problems stacked on top.
      </p>
      <p>
        <strong>First, you have to find the fires.</strong> Satellites spot fires by detecting
        heat from space. But clouds can hide a fire from the satellite. So can thick smoke from
        another fire. A fire the satellite can't see is a fire the forecast doesn't know about.
      </p>
      <p>
        <strong>Second, you have to guess the smoke.</strong> Nobody can measure exactly how much
        smoke a fire makes. Scientists estimate it from how hot the fire looks from space and what's
        burning underneath. Grass, pine forest, and swampy peat all burn differently and make
        different amounts of smoke.
      </p>
      <p>
        <strong>Third, you ride the wind.</strong> Smoke goes wherever the wind carries it —
        sometimes more than a thousand miles. If the wind forecast is off by even a little, the
        smoke ends up somewhere else. And height matters: smoke riding high in the sky might pass
        right over your town while the air at the ground stays clean. It's the low smoke you
        actually breathe.
      </p>
      <p>
        Each step adds a little error, and the errors multiply. That's why smoke forecasts are
        pretty sharp for the next day or two and get fuzzy after that — and why this page tells you
        when the models agree and when they don't.
      </p>
    </div>
  );
}
