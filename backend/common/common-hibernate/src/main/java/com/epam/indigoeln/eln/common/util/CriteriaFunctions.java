package com.epam.indigoeln.eln.common.util;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.jspecify.annotations.Nullable;

import java.util.Collection;

@ApplicationScoped
public class CriteriaFunctions {

    private static final char LIKE_ESCAPE = '\\';
    private static final String SIMILARITY_METRIC_TANIMOTO = "Tanimoto";
    private static final String ENGLISH = "english";

    @Inject
    HibernateCriteriaBuilder cb;

    public Expression<Boolean> fullTextMatch(Expression<SearchVector> attribute, String search) {
        return cb.function("full_text_search", Boolean.class, attribute, cb.literal(ENGLISH), cb.literal(fullTextQuery(search)));
    }

    public Expression<Double> fullTextRank(Expression<SearchVector> attribute, String search, @Nullable Expression<String> name) {
        Expression<Double> rank = cb.function("ts_rank", Double.class, attribute, cb.literal(ENGLISH), cb.literal(fullTextQuery(search)));
        if (name == null) {
            return rank;
        }
        // ts_rank stays below 1, so a name match ranks above any text-only match; name matches are still ordered by ts_rank.
        // Without the boost a name-only match (found by the fullTextSearch fallback) would rank 0, below every text match.
        Expression<Double> nameBoost = cb.<Double>selectCase()
                .when(contains(name, search), cb.literal(1.0))
                .otherwise(cb.literal(0.0));
        return cb.sum(rank, nameBoost);
    }

    public Expression<String> fullTextHeadline(Expression<String> attribute, String search, String options) {
        return cb.function("ts_headline", String.class, cb.literal(ENGLISH), attribute, cb.literal(ENGLISH), cb.literal(search), cb.literal(options));
    }

    public Expression<Boolean> moleculeExactMatch(Expression<String> attribute, String query) {
        return cb.function("bingo_exact_match", Boolean.class, attribute, cb.literal(query), cb.literal(""));
    }

    public Expression<Boolean> moleculeSubstructureMatch(Expression<String> attribute, String query) {
        return cb.function("bingo_substructure_match", Boolean.class, attribute, cb.literal(query), cb.literal(""));
    }

    public Expression<Boolean> moleculeSimilarityMatch(Expression<String> attribute, String query) {
        return cb.function("bingo_similarity_match", Boolean.class, attribute, cb.literal(0.8), cb.nullLiteral(Double.class), cb.literal(query), cb.literal(SIMILARITY_METRIC_TANIMOTO));
    }

    public Expression<Double> moleculeSimilarity(Expression<String> attribute, String query) {
        return cb.function("bingo_getsimilarity", Double.class, attribute, cb.literal(query), cb.literal(SIMILARITY_METRIC_TANIMOTO));
    }

    public Expression<Boolean> reactionExactMatch(Expression<String> attribute, String query) {
        return cb.function("bingo_rexact_match", Boolean.class, attribute, cb.literal(query), cb.literal(""));
    }

    public Expression<Boolean> reactionSubstructureMatch(Expression<String> attribute, String query) {
        return cb.function("bingo_rsubstructure_match", Boolean.class, attribute, cb.literal(query), cb.literal(""));
    }

    public <T> Expression<Boolean> arrayContains(T element, Expression<? extends Collection<T>> attribute) {
        return cb.function("array_contains", Boolean.class, cb.literal(element), attribute);
    }

    public Predicate startsWith(Expression<String> attribute, String value) {
        return cb.ilike(attribute, escapeLike(value) + '%', LIKE_ESCAPE);
    }

    public Predicate endsWith(Expression<String> attribute, String value) {
        return cb.ilike(attribute, '%' + escapeLike(value), LIKE_ESCAPE);
    }

    public Predicate contains(Expression<String> attribute, String value) {
        return cb.ilike(attribute, '%' + escapeLike(value) + '%', LIKE_ESCAPE);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String fullTextQuery(String search) {
        return search.replace('-', SearchVector.IDENTIFIER_SEPARATOR);
    }
}
