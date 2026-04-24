import TrainMeet from "./TrainMeet";

export default function Page() {
  return (
    <main>
      <h1>Train Meet</h1>
      <p className="lede">
        Pick two UK stations. We&apos;ll show you whether a direct train runs,
        and which stations are reachable directly from both — your one-change
        meeting points.
      </p>
      <TrainMeet />
      <footer>
        <p>
          <small>Timetable data from National Rail / RDG. Rebuilt weekly.</small>
        </p>
      </footer>
    </main>
  );
}
