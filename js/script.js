// User code will be written here to add code into the kernel
const player = {
  role: "Opening Batsman",
  name: "Harshveer Singh Jaspal",
  score: "254",
  balls: "122",

  nextBall: function (runs, status = "not out") {
    if (status === "not out") {
      this.score += runs;
      this.balls += 1;
    } else {
      this.score += runs;
      this.balls += 1;
      this.out = true;
    }
  },
};
