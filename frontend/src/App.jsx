import { useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");

  async function getMessage() {
    try {
      const response = await fetch("http://localhost:8000/api/hello");

      const data = await response.json();

      setMessage(data.message);
    } catch (error) {
      setMessage("Could not connect to backend");
    }
  }

  return (
    <div className="container">
      <h1>My First Web App</h1>

      <p>
        React frontend + Python backend
      </p>

      <button onClick={getMessage}>
        Talk to Python
      </button>

      {message && <p className="message">{message}</p>}
    </div>
  );
}

export default App;