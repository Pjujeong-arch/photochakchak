import { Component } from "react";

/** Catches render crashes so the screen is never a silent blank. */
export class ErrorBoundary extends Component {
  /** @param {object} props */
  constructor(props) {
    super(props);
    /** @type {{ error: unknown }} */
    this.state = { error: null };
  }

  /**
   * @param {unknown} error
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      const message =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : String(err);
      return (
        <div className="layout" style={{ padding: 24 }}>
          <h1 className="app-title">화면을 그리지 못했습니다</h1>
          <p style={{ color: "#b42318", marginTop: 12 }}>{message}</p>
          <p style={{ color: "#7a6a62", marginTop: 8 }}>
            터미널에서 <code>npm run dev</code> 후{" "}
            <a href="http://localhost:5173">http://localhost:5173</a> 을
            열어 주세요. 배포본은 <code>npm run build && npm start</code> →{" "}
            <a href="http://localhost:4173">http://localhost:4173</a>.
          </p>
        </div>
      );
    }
    return this.props.children || null;
  }
}
