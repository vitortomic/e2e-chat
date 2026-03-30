package com.e2echat.dao;

import com.e2echat.entity.OneTimePreKey;
import org.jdbi.v3.sqlobject.config.RegisterBeanMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OneTimePreKeyDao {

    @SqlUpdate("INSERT INTO one_time_pre_keys (user_id, key_id, key_data) " +
               "VALUES (:userId, :keyId, :keyData)")
    void insert(@Bind("userId") UUID userId,
                @Bind("keyId") Integer keyId,
                @Bind("keyData") String keyData);

    @SqlBatch("INSERT INTO one_time_pre_keys (user_id, key_id, key_data) " +
              "VALUES (:userId, :keyId, :keyData)")
    void insertBatch(@Bind("userId") List<UUID> userIds,
                     @Bind("keyId") List<Integer> keyIds,
                     @Bind("keyData") List<String> keyDatas);

    @SqlQuery("SELECT * FROM one_time_pre_keys WHERE user_id = :userId AND used = FALSE " +
              "ORDER BY key_id")
    @RegisterBeanMapper(OneTimePreKey.class)
    List<OneTimePreKey> findUnusedByUserId(@Bind("userId") UUID userId);

    @SqlQuery("SELECT * FROM one_time_pre_keys WHERE user_id = :userId AND used = FALSE " +
              "ORDER BY created_at ASC LIMIT 1 FOR UPDATE")
    @RegisterBeanMapper(OneTimePreKey.class)
    Optional<OneTimePreKey> findFirstUnused(@Bind("userId") UUID userId);

    @SqlUpdate("UPDATE one_time_pre_keys SET used = TRUE, used_at = NOW() WHERE id = :id")
    void markAsUsed(@Bind("id") UUID id);

    @SqlUpdate("DELETE FROM one_time_pre_keys WHERE user_id = :userId AND used = FALSE")
    void deleteUnusedByUserId(@Bind("userId") UUID userId);
}
