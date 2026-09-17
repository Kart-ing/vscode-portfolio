"use client";

// The cinematic title: the visitor's question, one word at a time, clipped
// and rising. The narration panel composes it.

import { Fragment } from "react";
import { motion, type Variants } from "motion/react";

const wordVariants: Variants = {
  hidden: { y: "112%", opacity: 0 },
  show: { y: "0%", opacity: 1, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] } },
  exit: { y: "-40%", opacity: 0, transition: { duration: 0.22, ease: [0.55, 0.085, 0.68, 0.53] } },
};

const wordVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const blockVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

export function lengthClass(question: string): "short" | "long" | "epic" {
  if (question.length > 110) return "epic";
  if (question.length > 60) return "long";
  return "short";
}

export function Title({ question, reduced }: { question: string; reduced: boolean }) {
  const words = question.split(/\s+/).filter(Boolean);
  return (
    <motion.h2
      className="display-condensed title"
      data-length={lengthClass(question)}
      initial="hidden"
      animate="show"
      exit="exit"
      variants={{ show: { transition: { staggerChildren: reduced ? 0 : 0.045 } } }}
    >
      {words.map((word, i) => (
        <Fragment key={`${i}-${word}`}>
          <span className="word-clip">
            <motion.span variants={reduced ? wordVariantsReduced : wordVariants}>{word}</motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </motion.h2>
  );
}
