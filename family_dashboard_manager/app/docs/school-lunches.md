# School lunch menus

Lunch menus work without a Classroom connection. Add `school.lunch_menus` in the
existing School settings; leave `features.school` unchanged if Classroom is off.
Each child has either a `pending` menu or a `published` menu with term start/end
dates, a Week 1 Monday, and a rotation of one to six weeks. Every week contains
five meal objects in Monday-to-Friday order: `mains`, optional `sides` and
`dessert`. The first main is shown on Today; other main meals can be expanded in
the weekly view. Sandwich listings are not needed.

Optional `packed_lunch_days` rules use a one-based rotation `week` and a
`weekday` from 1 (Monday) to 5 (Friday). These replace the whole school meal,
including its sides and dessert, with a packed-lunch reminder.
Optional `closed_dates` suppress lunches for inset days and holidays. Rotation
continues by calendar week, including closed weeks. Set a new Week 1 date if a
later term starts a new cycle.

Today shows each child’s current lunch or a clear upcoming, closed, ended or
unpublished state. Tasks → Lunch lets the family browse term weeks and switch
children. Menus outside their valid dates are never presented as today’s food.
Household meal data belongs only in the private configuration, not this repo.
