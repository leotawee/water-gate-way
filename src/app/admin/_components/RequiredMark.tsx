/** Red asterisk marking a required field; the input itself carries the real `required` attribute. */
export default function RequiredMark() {
  return (
    <span className="text-danger" aria-hidden="true">
      *
    </span>
  );
}
